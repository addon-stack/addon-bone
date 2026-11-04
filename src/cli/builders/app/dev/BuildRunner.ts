import {fork, type ChildProcess} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

import type {BuildRunnerEvent, BuildRunnerOptions, BuildRunnerRequest} from "./protocol";

export type BuildRunnerListener = (event: BuildRunnerEvent) => void;

export type BuildRunnerExit = {
    code: number | null;
    signal: NodeJS.Signals | null;
    /** Set when the process could not be started, in which case Node may never emit `exit`. */
    error?: Error;
};

const OutputLimit = 64 * 1024;

/** Time the process gets after its close budget to report a failure and exit before it is killed. */
const ExitGrace = 2_000;

/** Runs the dev build in its own process so project config, plugins and crashes stay isolated from the session. */
export default class BuildRunner {
    private ended?: BuildRunnerExit;
    private resolveExit?: (exit: BuildRunnerExit) => void;
    private tail = "";
    private readonly listeners = new Set<BuildRunnerListener>();

    public readonly exited: Promise<BuildRunnerExit>;

    private constructor(private readonly child: ChildProcess) {
        this.exited = new Promise(resolve => {
            this.resolveExit = resolve;
        });

        // Config files and third-party plugins may write to either stream; an unread pipe can block the child.
        for (const stream of [child.stdout, child.stderr]) {
            stream?.setEncoding("utf8");
            stream?.on("data", (chunk: string) => {
                this.tail = (this.tail + chunk).slice(-OutputLimit);
            });
        }

        child.on("message", event => {
            this.listeners.forEach(listener => listener(event as BuildRunnerEvent));
        });

        child.once("exit", (code, signal) => this.finish({code, signal}));
        child.on("error", error => {
            // Without a pid the process never started, so no `exit` follows.
            if (child.pid === undefined) {
                this.finish({code: null, signal: null, error});
            }
        });
    }

    /** Starts watching `options.rootDir`; compilations are numbered from `buildId`. */
    public static start(options: BuildRunnerOptions, buildId = 1): BuildRunner {
        const rootDir = path.resolve(options.rootDir ?? ".");

        // Virtual modules are written under the working directory, so each project gets its own process cwd.
        const child = fork(fileURLToPath(new URL("./build-runner-child.js", import.meta.url)), [], {
            cwd: rootDir,
            stdio: ["ignore", "pipe", "pipe", "ipc"],
        });

        const runner = new BuildRunner(child);

        runner.request({type: "start", options: {...options, rootDir}, buildId});

        return runner;
    }

    /** Recent stdout and stderr of the build process, for diagnostics. */
    public get output(): string {
        return this.tail;
    }

    public get pid(): number | undefined {
        return this.child.pid;
    }

    public on(listener: BuildRunnerListener): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    /** Resolves with the exit status, or `undefined` when the process is still running after `timeout`. */
    public async waitForExit(timeout: number): Promise<BuildRunnerExit | undefined> {
        let timer: ReturnType<typeof setTimeout> | undefined;

        const expired = new Promise<undefined>(resolve => {
            timer = setTimeout(() => resolve(undefined), timeout);
        });

        try {
            return await Promise.race([this.exited, expired]);
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Gives the compiler `timeout` to close. A failed or late close makes the process report `E_CLOSE_FAILED`
     * and exit with code 1; a process that still runs after that is killed.
     */
    public async close(timeout = 10_000): Promise<BuildRunnerExit> {
        if (this.ended) {
            return this.ended;
        }

        this.request({type: "close", timeout});

        const exited = await this.waitForExit(timeout + ExitGrace);

        if (exited) {
            return exited;
        }

        this.child.kill("SIGKILL");

        return this.exited;
    }

    private request(request: BuildRunnerRequest): void {
        if (this.child.connected) {
            this.child.send(request);
        }
    }

    private finish(exit: BuildRunnerExit): void {
        if (this.ended) {
            return;
        }

        this.ended = exit;
        this.child.stdout?.destroy();
        this.child.stderr?.destroy();
        this.resolveExit?.(exit);
    }
}
