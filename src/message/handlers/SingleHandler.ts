import AbstractHandler from "./AbstractHandler";
import {
    MessageData,
    MessageDictionary,
    MessageResponse,
    MessageSender,
    MessageTargetHandler,
    MessageType,
} from "@typing/message";

export default class SingleHandler<T extends MessageDictionary> extends AbstractHandler<T> {
    constructor(
        private messageType: MessageType<T>,
        private handler: MessageTargetHandler<T, MessageType<T>>
    ) {
        super();
    }

    public run(
        type: MessageType<T>,
        data: MessageData<T, MessageType<T>>,
        sender: MessageSender
    ): MessageResponse<T, MessageType<T>> | undefined | null {
        if (type === this.messageType) {
            return this.handler(data, sender) || null;
        }
    }
}
