import {fork, type ChildProcess} from "node:child_process";
import {appendFileSync} from "node:fs";
import {mkdir, mkdtemp, rm} from "node:fs/promises";
import path from "node:path";

import type {
    BuildSessionFailure,
    BuildSessionRequest,
    BuildSessionResponse,
    BuildSessionSample,
} from "./build-session-protocol";

interface BuildSessionPending {
    id: number;
    resolve(sample: BuildSessionSample): void;
    reject(error: Error): void;
    timer: NodeJS.Timeout;
}

export class BuildSessionError extends Error {
    readonly stats?: string;

    constructor(failure: BuildSessionFailure) {
        super(failure.message, failure.cause ? {cause: new BuildSessionError(failure.cause)} : undefined);
        this.name = failure.name;
        this.stats = failure.stats;
    }
}

/** One file owns one process; builds are sequential and cwd never changes. */
export default class BuildSession {
    private readonly child: ChildProcess;
    private readonly closed: Promise<void>;
    private pending?: BuildSessionPending;
    private sequence = 0;
    private stopped = false;
    private failure?: Error;
    private output = "";
    private disposal?: Promise<void>;

    private constructor(
        readonly directory: string,
        projectRoot: string
    ) {
        this.child = fork(path.join(projectRoot, "tests/integration/utils/build-session-child.mjs"), [projectRoot], {
            cwd: directory,
            // Keep Node flags, including the macOS JIT workaround and optional benchmark GC.
            execArgv: process.execArgv.filter(flag => flag === "--no-sparkplug" || flag === "--expose-gc"),
            stdio: ["ignore", "pipe", "pipe", "ipc"],
        });

        const capture = (chunk: Buffer) => {
            this.output = (this.output + chunk.toString()).slice(-64 * 1024);
        };

        this.child.stdout!.on("data", capture);
        this.child.stderr!.on("data", capture);
        this.child.on("message", message => this.receive(message as BuildSessionResponse));
        this.child.once("error", error => this.terminate(error));
        this.closed = new Promise(resolve => {
            this.child.once("close", (code, signal) => {
                this.stopped = true;
                const pending = this.pending;
                this.pending = undefined;

                if (pending) {
                    clearTimeout(pending.timer);
                    pending.reject(
                        this.failure ?? new Error(`Build session exited with ${signal ?? code}\n${this.output}`)
                    );
                }

                resolve();
            });
        });
    }

    static async create(projectRoot: string): Promise<BuildSession> {
        const parent = path.join(projectRoot, ".cache/integration");
        await mkdir(parent, {recursive: true});
        const directory = await mkdtemp(path.join(parent, "session-"));

        try {
            // The external plugin's parent-directory creation is not atomic. This directory is session-owned.
            await mkdir(path.join(directory, "node_modules"), {recursive: true});

            return new BuildSession(directory, projectRoot);
        } catch (error) {
            await rm(directory, {recursive: true, force: true});
            throw error;
        }
    }

    get pid(): number | undefined {
        return this.child.pid;
    }

    async build(
        rootDir: string,
        browser = "chrome",
        manifestVersion: 2 | 3 = 3,
        timeout = 30_000
    ): Promise<BuildSessionSample> {
        if (this.stopped) {
            throw new Error("Build session is closed");
        }

        if (this.pending) {
            throw new Error("Build session already has a pending request; await it before starting another");
        }

        this.output = "";
        const id = ++this.sequence;
        const request: BuildSessionRequest = {
            id,
            rootDir: path.resolve(rootDir),
            browser,
            manifestVersion,
            environment: {...process.env},
        };

        return new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => this.terminate(new Error(`Build session timed out after ${timeout} ms\n${this.output}`)),
                timeout
            );

            this.pending = {id, resolve, reject, timer};
            this.child.send(request, error => {
                if (error) {
                    this.terminate(error);
                }
            });
        });
    }

    private receive(response: BuildSessionResponse): void {
        const pending = this.pending;

        if (this.stopped || !pending || response.id !== pending.id) {
            return;
        }

        clearTimeout(pending.timer);
        this.pending = undefined;

        try {
            // Diagnostics are opt-in and report the child, never Jest worker memory.
            if (process.env.ADNBN_SESSION_METRICS) {
                appendFileSync(process.env.ADNBN_SESSION_METRICS, JSON.stringify(response.sample) + "\n");
            }

            if (response.error) {
                pending.reject(new BuildSessionError(response.error));
            } else {
                pending.resolve(response.sample);
            }
        } catch (error) {
            pending.reject(error as Error);
        }
    }

    private terminate(error: Error): void {
        this.failure ??= error;
        this.stopped = true;
        this.child.kill("SIGKILL");
    }

    dispose(): Promise<void> {
        this.disposal ??= this.close();

        return this.disposal;
    }

    private async close(): Promise<void> {
        this.stopped = true;

        if (this.pending) {
            this.terminate(new Error("Build session disposed during a pending request"));
        } else if (this.child.connected) {
            this.child.send({close: true}, error => {
                if (error) {
                    this.terminate(error);
                }
            });
        }

        const timer = setTimeout(() => this.child.kill("SIGKILL"), 5_000);

        try {
            await this.closed;
        } finally {
            clearTimeout(timer);
            await rm(this.directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
        }
    }
}
