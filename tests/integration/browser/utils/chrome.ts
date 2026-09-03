import path from "path";
import {spawnSync} from "child_process";

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
