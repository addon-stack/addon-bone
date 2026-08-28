import {nanoid} from "nanoid";
import {
    MessageBody,
    MessageData,
    MessageDictionary,
    MessageGeneralHandler,
    MessageMapHandler,
    MessageProvider,
    MessageResponse,
    MessageTargetHandler,
    MessageType,
} from "@typing/message";

export default abstract class AbstractMessage<T extends MessageDictionary, TOptions> implements MessageProvider<
    T,
    TOptions
> {
    public abstract send<K extends MessageType<T>>(
        type: K,
        data: MessageData<T, K>,
        options?: TOptions
    ): Promise<MessageResponse<T, K>>;

    public abstract watch<K extends MessageType<T>>(type: K, handler: MessageTargetHandler<T, K>): () => void;

    public abstract watch(map: MessageMapHandler<T>): () => void;

    public abstract watch<K extends MessageType<T>>(general: MessageGeneralHandler<T, K>): () => void;

    protected buildMessage<K extends MessageType<T>>(type: K, data: MessageData<T, K>): MessageBody<T, K> {
        return {
            id: nanoid(),
            type,
            data,
            timestamp: Date.now(),
        };
    }
}
