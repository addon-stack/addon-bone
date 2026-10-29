import {spawn} from "child_process";
import type {ChildProcess} from "child_process";
import type {Readable, Writable} from "stream";

import {createPipeFrameReader} from "./pipe-frames";

export type CdpPipeMessage = {
    id?: number;
    method?: string;
    params?: Record<string, any>;
    result?: Record<string, any>;
    error?: {message: string; code?: number};
    sessionId?: string;
};

export type CdpPipeListener = (message: CdpPipeMessage) => void;

export type CdpPipeExit = {
    code: number | null;
    signal: NodeJS.Signals | null;
    /** Set when the process could not be started, in which case Node may never emit `exit`. */
    error?: Error;
};

type CdpPipePendingRequest = {
    resolve: (value: Record<string, any>) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
};

/** Chrome DevTools Protocol over `--remote-debugging-pipe`: the browser reads fd 3 and writes fd 4. */
export default class CdpPipeClient {
    private nextId = 1;
    private failure?: Error;
    private ended?: CdpPipeExit;
    private resolveExit?: (exit: CdpPipeExit) => void;
    private readonly pending = new Map<number, CdpPipePendingRequest>();
    private readonly listeners = new Set<CdpPipeListener>();
    private readonly writer: Writable;

    public readonly exited: Promise<CdpPipeExit>;
    public output = "";

    private constructor(public readonly process: ChildProcess) {
        this.exited = new Promise(resolve => {
            this.resolveExit = resolve;
        });

        this.writer = process.stdio[3] as Writable;

        const reader = process.stdio[4] as Readable;

        reader.on(
            "data",
            createPipeFrameReader(frame => this.dispatch(JSON.parse(frame) as CdpPipeMessage))
        );
        reader.on("error", error => this.fail(error));
        this.writer.on("error", error => this.fail(error));

        process.stderr?.setEncoding("utf8");
        process.stderr?.on("data", (chunk: string) => {
            this.output += chunk;
        });

        process.once("exit", (code, signal) => this.finish({code, signal}));
        process.on("error", error => {
            // Without a pid the executable never started, so no `exit` follows.
            if (process.pid === undefined) {
                this.finish({code: null, signal: null, error});
            } else {
                this.fail(error);
            }
        });
    }

    public static launch(binary: string, args: string[]): CdpPipeClient {
        const child = spawn(binary, args, {stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"]});

        return new CdpPipeClient(child);
    }

    public send(
        method: string,
        params: Record<string, unknown> = {},
        sessionId?: string,
        timeout = 15_000
    ): Promise<Record<string, any>> {
        if (this.failure) {
            return Promise.reject(this.failure);
        }

        const id = this.nextId++;

        return new Promise((resolve, reject) => {
            const requestTimeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Chrome DevTools request timed out after ${timeout} ms: ${method}`));
            }, timeout);

            this.pending.set(id, {resolve, reject, timeout: requestTimeout});
            this.writer.write(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}) + "\0");
        });
    }

    public on(listener: CdpPipeListener): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    /** Closes the browser end of the pipe; Chrome exits when it loses its DevTools connection. */
    public closePipe(): void {
        this.writer.end();
    }

    /** Resolves with the exit status, or `undefined` when Chrome is still running after `timeout`. */
    public async waitForExit(timeout: number): Promise<CdpPipeExit | undefined> {
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

    /** Stops Chrome within two `timeout` periods: a DevTools close, then SIGKILL. */
    public async close(timeout = 5_000): Promise<CdpPipeExit> {
        if (this.ended) {
            return this.ended;
        }

        if (!this.failure) {
            await this.send("Browser.close", {}, undefined, timeout).catch(() => undefined);
        }

        const exited = await this.waitForExit(timeout);

        if (exited) {
            return exited;
        }

        this.process.kill("SIGKILL");

        const killed = await this.waitForExit(timeout);

        if (killed) {
            return killed;
        }

        throw new Error(`Chrome ${this.process.pid} did not exit after SIGKILL`);
    }

    private dispatch(message: CdpPipeMessage): void {
        if (message.id === undefined) {
            this.listeners.forEach(listener => listener(message));

            return;
        }

        const pending = this.pending.get(message.id);

        if (!pending) {
            return;
        }

        this.pending.delete(message.id);
        clearTimeout(pending.timeout);

        if (message.error) {
            pending.reject(new Error(message.error.message));
        } else {
            pending.resolve(message.result ?? {});
        }
    }

    /** Rejects current and future requests; the process may still be running. */
    private fail(error: Error): void {
        this.failure ??= error;
        this.pending.forEach(pending => {
            clearTimeout(pending.timeout);
            pending.reject(error);
        });
        this.pending.clear();
    }

    private finish(exit: CdpPipeExit): void {
        if (this.ended) {
            return;
        }

        this.ended = exit;
        this.fail(exit.error ?? new Error(`Chrome exited (${exit.code ?? exit.signal})`));
        this.process.stdio.forEach(stream => stream?.destroy());
        this.resolveExit?.(exit);
    }
}
