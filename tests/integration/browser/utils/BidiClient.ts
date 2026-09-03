interface BidiMessage {
    id?: number;
    type: string;
    method?: string;
    params?: {level?: string; text?: string};
    result?: Record<string, any>;
    error?: string;
    message?: string;
}

interface BidiPendingRequest {
    resolve(value: Record<string, any>): void;
    reject(error: Error): void;
    timeout: NodeJS.Timeout;
}

/** Minimal WebDriver BiDi client for Firefox integration tests. */
export default class BidiClient {
    private nextId = 1;
    private readonly pending = new Map<number, BidiPendingRequest>();

    public readonly runtimeErrors: string[] = [];

    private constructor(private readonly socket: WebSocket) {
        socket.addEventListener("message", event => this.receive(JSON.parse(String(event.data))));
        socket.addEventListener("close", () => this.rejectPending(new Error("Firefox BiDi connection closed")));
        socket.addEventListener("error", () => this.rejectPending(new Error("Firefox BiDi connection failed")));
    }

    public static connect(url: string, timeout = 1_000): Promise<BidiClient> {
        return new Promise((resolve, reject) => {
            const socket = new WebSocket(url);
            const timer = setTimeout(() => {
                socket.close();
                reject(new Error(`Timed out connecting to Firefox BiDi at ${url}`));
            }, timeout);

            socket.addEventListener(
                "open",
                () => {
                    clearTimeout(timer);
                    resolve(new BidiClient(socket));
                },
                {once: true}
            );
            socket.addEventListener(
                "error",
                () => {
                    clearTimeout(timer);
                    reject(new Error(`Unable to connect to Firefox BiDi at ${url}`));
                },
                {once: true}
            );
        });
    }

    public send(method: string, params: Record<string, unknown> = {}, timeout = 15_000): Promise<Record<string, any>> {
        const id = this.nextId++;

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Firefox BiDi request timed out: ${method}`));
            }, timeout);

            this.pending.set(id, {resolve, reject, timeout: timer});

            try {
                this.socket.send(JSON.stringify({id, method, params}));
            } catch (error) {
                this.pending.delete(id);
                clearTimeout(timer);
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }

    public async evaluate<T>(context: string, expression: string): Promise<T | undefined> {
        const response = await this.send("script.evaluate", {
            target: {context},
            expression: `(async () => JSON.stringify(await (${expression})))()`,
            awaitPromise: true,
        });

        if (response.type === "exception") {
            throw new Error(response.exceptionDetails?.text ?? "Firefox evaluation failed");
        }

        return response.result?.type === "undefined" ? undefined : JSON.parse(response.result.value);
    }

    public async close(): Promise<void> {
        if (this.socket.readyState === WebSocket.CLOSED) {
            return;
        }

        await new Promise<void>(resolve => {
            const timer = setTimeout(resolve, 1_000);
            this.socket.addEventListener(
                "close",
                () => {
                    clearTimeout(timer);
                    resolve();
                },
                {once: true}
            );
            this.socket.close();
        });
    }

    private receive(message: BidiMessage): void {
        if (message.method === "log.entryAdded" && message.params?.level === "error") {
            this.runtimeErrors.push(message.params.text ?? "Firefox runtime error");
        }

        if (message.id === undefined) {
            return;
        }

        const pending = this.pending.get(message.id);

        if (!pending) {
            return;
        }

        this.pending.delete(message.id);
        clearTimeout(pending.timeout);

        if (message.type === "error") {
            pending.reject(new Error(message.message ?? message.error ?? "Firefox BiDi request failed"));
        } else {
            pending.resolve(message.result ?? {});
        }
    }

    private rejectPending(error: Error): void {
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timeout);
            pending.reject(error);
        }
        this.pending.clear();
    }
}
