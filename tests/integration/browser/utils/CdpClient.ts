type CdpMessage = {
    id?: number;
    method?: string;
    params?: Record<string, unknown>;
    result?: Record<string, any>;
    error?: {message: string};
    sessionId?: string;
};

type CdpPendingRequest = {
    resolve: (value: Record<string, any>) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
};

export default class CdpClient {
    private nextId = 1;
    private readonly pending = new Map<number, CdpPendingRequest>();

    public readonly runtimeErrors: string[] = [];
    public readonly requests: string[] = [];

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
        if (message.method === "Network.requestWillBeSent") {
            const request = message.params?.request as {url: string};
            this.requests.push(request.url);
        }

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
