import {onMessage} from "@addon-core/browser";

import {
    MessageBody,
    MessageDictionary,
    MessageError,
    MessageGlobalKey,
    MessageHandler,
    MessageResult,
    MessageResultEnvelopeProperty,
    MessageSender,
    MessageType,
} from "@typing/message";

export default class MessageManager<T extends MessageDictionary> {
    private handlers: Set<MessageHandler<T>> = new Set();
    private unsubscribe: (() => void) | null = null;

    public static getInstance<T extends MessageDictionary>(): MessageManager<T> {
        return (globalThis[MessageGlobalKey] ??= new MessageManager<T>());
    }

    constructor() {
        this.listener = this.listener.bind(this);
    }

    public add(handler: MessageHandler<T>) {
        this.handlers.add(handler);
        this.updateListener();
    }

    public remove(handler: MessageHandler<T>) {
        this.handlers.delete(handler);
        this.updateListener();
    }

    public clear() {
        this.handlers = new Set();
        this.updateListener();
    }

    private updateListener() {
        if (this.handlers.size > 0 && !this.unsubscribe) {
            this.unsubscribe = onMessage(this.listener);
        } else if (this.handlers.size === 0 && this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    private listener<K extends MessageType<T>>(
        message: MessageBody<T, K>,
        sender: MessageSender,
        sendResponse: (response?: MessageResult) => void
    ): boolean | void {
        if (!message || typeof message !== "object" || !message.type) {
            return;
        }

        const results: Promise<any>[] = [];

        for (const handler of this.handlers) {
            try {
                const result = handler.run(message.type, message.data, sender);

                if (result !== undefined) {
                    results.push(Promise.resolve(result));
                }
            } catch (err) {
                results.push(Promise.reject(err));
            }
        }

        if (results.length > 1) {
            sendResponse(
                this.failure(
                    new Error(
                        `Message type "${message.type}" has multiple handlers returning a response. Only one response is allowed.`
                    )
                )
            );

            return true;
        }

        if (results.length === 1) {
            results[0].then(
                result => sendResponse(this.success(result)),
                error => sendResponse(this.failure(error))
            );

            return true;
        }
    }

    private success<TData>(payload: TData): MessageResult<TData> {
        return {[MessageResultEnvelopeProperty]: true, ok: true, payload};
    }

    private failure(error: unknown): MessageResult<never> {
        return {[MessageResultEnvelopeProperty]: true, ok: false, error: this.serializeError(error)};
    }

    private serializeError(error: unknown): MessageError {
        if (error instanceof Error) {
            return this.error(error.name, error.message, error.stack);
        }

        if (typeof error === "object" && error !== null) {
            const record = error as Record<string, unknown>;
            const name = typeof record.name === "string" ? record.name : "Error";
            const message = typeof record.message === "string" ? record.message : this.stringifyError(error);
            const stack = typeof record.stack === "string" ? record.stack : undefined;

            return this.error(name, message, stack);
        }

        return this.error("Error", String(error));
    }

    private stringifyError(error: object): string {
        try {
            return JSON.stringify(error);
        } catch {
            return String(error);
        }
    }

    private error(name: string, message: string, stack?: string): MessageError {
        return stack ? {name, message, stack} : {name, message};
    }
}
