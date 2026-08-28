import {createServer} from "net";
import path from "path";
import {spawn, spawnSync, type ChildProcess} from "child_process";

type CdpMessage = {
    id?: number;
    method?: string;
    params?: Record<string, unknown>;
    result?: Record<string, any>;
    error?: {message: string};
    sessionId?: string;
};

export type CdpTarget = {
    id: string;
    type: string;
    url: string;
};

type CdpPendingRequest = {
    resolve: (value: Record<string, any>) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
};

export const findChromeBinary = (rootDir: string): string | undefined => {
    if (process.env.ADNBN_CHROME_BIN) {
        return process.env.ADNBN_CHROME_BIN;
    }

    const result = spawnSync(
        process.execPath,
        [path.join(rootDir, "node_modules", "chrome-launcher", "bin", "print-chrome-path.cjs")],
        {encoding: "utf8"}
    );
    const chromePath = result.status === 0 ? result.stdout.trim() : "";

    return chromePath || undefined;
};

const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

export const waitFor = async <T>(callback: () => Promise<T | undefined>, timeout = 15_000): Promise<T> => {
    const deadline = Date.now() + timeout;
    let lastError: unknown;

    while (Date.now() < deadline) {
        try {
            const value = await callback();

            if (value !== undefined) {
                return value;
            }
        } catch (error) {
            lastError = error;
        }

        await delay(100);
    }

    const detail = lastError instanceof Error ? `: ${lastError.message}` : "";

    throw new Error(`Timed out waiting for Chrome${detail}`);
};

export const getFreePort = (): Promise<number> => {
    return new Promise((resolve, reject) => {
        const server = createServer();

        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();

            if (!address || typeof address === "string") {
                server.close();
                reject(new Error("Unable to reserve a debugging port"));

                return;
            }

            server.close(error => (error ? reject(error) : resolve(address.port)));
        });
    });
};

export const run = (command: string, args: string[], cwd: string, timeout = 30_000): Promise<void> => {
    return new Promise((resolve, reject) => {
        const process = spawn(command, args, {cwd, stdio: ["ignore", "pipe", "pipe"]});
        let output = "";
        let settled = false;

        const finish = (callback: () => void): void => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(runTimeout);
            callback();
        };
        const runTimeout = setTimeout(() => {
            process.kill("SIGKILL");
            finish(() => reject(new Error(`${command} ${args.join(" ")} timed out after ${timeout} ms\n${output}`)));
        }, timeout);

        process.stdout.on("data", chunk => (output += chunk));
        process.stderr.on("data", chunk => (output += chunk));
        process.once("error", error => finish(() => reject(error)));
        process.once("exit", code => {
            if (code === 0) {
                finish(resolve);
            } else {
                finish(() => reject(new Error(`${command} ${args.join(" ")} exited with ${code}\n${output}`)));
            }
        });
    });
};

export class CdpClient {
    private nextId = 1;
    private readonly pending = new Map<number, CdpPendingRequest>();

    public readonly runtimeErrors: string[] = [];

    private constructor(private readonly socket: WebSocket) {
        socket.addEventListener("message", event => this.receive(JSON.parse(String(event.data))));
        socket.addEventListener("close", () => this.rejectPending(new Error("Chrome DevTools connection closed")));
        socket.addEventListener("error", () => this.rejectPending(new Error("Chrome DevTools connection failed")));
    }

    public static async connect(url: string, timeout = 15_000): Promise<CdpClient> {
        return new Promise((resolve, reject) => {
            const socket = new WebSocket(url);
            const connectTimeout = setTimeout(() => {
                socket.close();
                reject(new Error(`Timed out connecting to Chrome DevTools after ${timeout} ms: ${url}`));
            }, timeout);

            socket.addEventListener(
                "open",
                () => {
                    clearTimeout(connectTimeout);
                    resolve(new CdpClient(socket));
                },
                {once: true}
            );
            socket.addEventListener(
                "error",
                () => {
                    clearTimeout(connectTimeout);
                    reject(new Error(`Unable to connect to Chrome DevTools at ${url}`));
                },
                {
                    once: true,
                }
            );
        });
    }

    public send(
        method: string,
        params: Record<string, unknown> = {},
        sessionId?: string,
        timeout = 15_000
    ): Promise<Record<string, any>> {
        const id = this.nextId++;

        return new Promise((resolve, reject) => {
            const requestTimeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Chrome DevTools request timed out after ${timeout} ms: ${method}`));
            }, timeout);

            this.pending.set(id, {resolve, reject, timeout: requestTimeout});

            try {
                this.socket.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
            } catch (error) {
                this.pending.delete(id);
                clearTimeout(requestTimeout);
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }

    public async close(): Promise<void> {
        if (this.socket.readyState === WebSocket.CLOSED) {
            return;
        }

        await new Promise<void>(resolve => {
            const timeout = setTimeout(resolve, 1_000);

            this.socket.addEventListener(
                "close",
                () => {
                    clearTimeout(timeout);
                    resolve();
                },
                {once: true}
            );
            this.socket.close();
        });
    }

    private receive(message: CdpMessage): void {
        if (message.method === "Runtime.exceptionThrown") {
            const details = message.params?.exceptionDetails as
                | {text?: string; exception?: {description?: string}}
                | undefined;

            this.runtimeErrors.push(details?.exception?.description ?? details?.text ?? "Unknown runtime exception");
        }

        if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
            const args = (message.params.args ?? []) as Array<{value?: unknown; description?: string}>;

            this.runtimeErrors.push(args.map(arg => String(arg.value ?? arg.description ?? "")).join(" "));
        }

        if (message.id !== undefined) {
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

            return;
        }
    }

    private rejectPending(error: Error): void {
        this.pending.forEach(pending => {
            clearTimeout(pending.timeout);
            pending.reject(error);
        });
        this.pending.clear();
    }
}

export const targets = async (port: number): Promise<CdpTarget[]> => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {signal: AbortSignal.timeout(5_000)});

    return response.json() as Promise<CdpTarget[]>;
};

export const browserVersion = async (port: number): Promise<{webSocketDebuggerUrl: string}> => {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {signal: AbortSignal.timeout(5_000)});

    return response.json() as Promise<{webSocketDebuggerUrl: string}>;
};

export const stop = async (process: ChildProcess): Promise<void> => {
    if (process.exitCode !== null || process.killed) {
        return;
    }

    const waitForExit = (timeout: number): Promise<boolean> =>
        new Promise(resolve => {
            const onExit = () => {
                clearTimeout(timer);
                resolve(true);
            };
            const timer = setTimeout(() => {
                process.off("exit", onExit);
                resolve(false);
            }, timeout);

            process.once("exit", onExit);
        });

    const stopProcess = (signal: NodeJS.Signals): void => {
        try {
            process.kill(signal);
        } catch (error) {
            if (!(error instanceof Error) || !error.message.includes("ESRCH")) {
                throw error;
            }
        }
    };

    const stopped = waitForExit(5_000);

    stopProcess("SIGTERM");

    if (!(await stopped) && process.exitCode === null) {
        const killed = waitForExit(5_000);

        stopProcess("SIGKILL");
        await killed;
    }
};
