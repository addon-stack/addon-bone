import {
    MessageData,
    MessageDictionary,
    MessageHandler,
    MessageResponse,
    MessageSender,
    MessageType,
} from "@typing/message";

export default abstract class AbstractHandler<T extends MessageDictionary> implements MessageHandler<T> {
    public abstract run(
        type: MessageType<T>,
        data: MessageData<T, MessageType<T>>,
        sender: MessageSender
    ): MessageResponse<T, MessageType<T>> | undefined | null;
}
