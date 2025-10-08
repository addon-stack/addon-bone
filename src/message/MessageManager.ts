import {onMessage} from "@addon-core/browser";

import {
    MessageBody,
    MessageDictionary,
    MessageGlobalKey,
    MessageHandler,
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
        sendResponse: (response?: any) => void
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
                console.error("Message handler error:", err);
            }
        }

        if (results.length > 1) {
            throw new Error(
                `Message type "${message.type}" has multiple handlers returning a response. Only one response is allowed.`
            );
        }

        if (results.length === 1) {
            results[0].then(sendResponse);

            return true;
        }
    }
}
