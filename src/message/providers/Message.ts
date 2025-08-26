import {sendMessage, sendTabMessage} from "@adnbn/browser";

import {
    MessageData,
    MessageDictionary,
    MessageGeneralHandler,
    MessageHandler,
    MessageMapHandler,
    MessageResponse,
    MessageSendOptions,
    MessageTargetHandler,
    MessageType,
} from "@typing/message";

import AbstractMessage from "./AbstractMessage";
import MessageManager from "../MessageManager";

import {GeneralHandler, MapHandler, SingleHandler} from "../handlers";

export default class Message<T extends MessageDictionary> extends AbstractMessage<T, MessageSendOptions> {
    private static instance: Message<MessageDictionary> | null = null;

    public static getInstance<T extends MessageDictionary>() {
        return (this.instance ??= new Message<T>());
    }

    protected get manager(): MessageManager<T> {
        return MessageManager.getInstance<T>();
    }

    public send<K extends MessageType<T>>(
        type: K,
        data: MessageData<T, K>,
        options?: MessageSendOptions
    ): Promise<MessageResponse<T, K>> {
        const message = this.buildMessage(type, data);

        if (options) {
            if (typeof options === "number") {
                return sendTabMessage(options, message);
            }

            const {tabId, ...other} = options;

            return sendTabMessage(tabId, message, other);
        }

        return sendMessage(message);
    }

    public watch<K extends MessageType<T>>(
        arg1: K | MessageMapHandler<T> | MessageGeneralHandler<T, K>,
        arg2?: MessageTargetHandler<T, K>
    ): () => void {
        let handler: MessageHandler<T>;

        if (typeof arg1 === "function") {
            handler = new GeneralHandler<T, K>(arg1);
        } else if (typeof arg1 === "object" && arg2 === undefined) {
            handler = new MapHandler<T>(arg1);
        } else if (typeof arg1 === "string" && arg2) {
            handler = new SingleHandler<T>(arg1, arg2);
        } else {
            throw new Error("Invalid arguments passed to watch()");
        }

        this.manager.add(handler);

        return () => this.manager.remove(handler);
    }
}
