import AbstractHandler from "./AbstractHandler";
import {
    MessageData,
    MessageDictionary,
    MessageMapHandler,
    MessageResponse,
    MessageSender,
    MessageType,
} from "@typing/message";

export default class MapHandler<T extends MessageDictionary> extends AbstractHandler<T> {
    constructor(private map: MessageMapHandler<T>) {
        super();
    }

    public run(
        type: MessageType<T>,
        data: MessageData<T, MessageType<T>>,
        sender: MessageSender
    ): MessageResponse<T, MessageType<T>> | undefined | null {
        const handler = this.map[type];

        if (handler) {
            if (typeof handler === "function") {
                return handler(data, sender) || null;
            } else {
                throw new Error(`Handler for type "${type}" in object of handlers must be a function`);
            }
        }
    }
}
