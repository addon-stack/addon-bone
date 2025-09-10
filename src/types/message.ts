export const MessageGlobalKey = "adnbnMessage";

export const MessageTypeSeparator = ":";

export const MessageSenderProperty = "_sender";

export type MessageSender = chrome.runtime.MessageSender;

export type MessageSendOptions = number | {tabId: number; frameId?: number; documentId?: string};

export interface MessageDictionary {
    [key: string]: (data: any) => any;
}

export interface MessageSenderAware {
    [MessageSenderProperty]?: MessageSender;
}

export type MessageType<T extends MessageDictionary> = Extract<keyof T, string>;
export type MessageData<T extends MessageDictionary, K extends MessageType<T>> = Parameters<T[K]>[0];
export type MessageResponse<T extends MessageDictionary, K extends MessageType<T>> = ReturnType<T[K]>;

export type MessageTargetHandler<T extends MessageDictionary, K extends MessageType<T>> = (
    data: MessageData<T, K>,
    sender: MessageSender
) => MessageResponse<T, K>;
export type MessageMapHandler<T extends MessageDictionary> = {[K in MessageType<T>]?: MessageTargetHandler<T, K>};
export type MessageGeneralHandler<T extends MessageDictionary, K extends MessageType<T>> = (
    type: K,
    data: MessageData<T, K>,
    sender: MessageSender
) => any;

export interface MessageBody<T extends MessageDictionary, K extends MessageType<T>> {
    id: string;
    type: K;
    data: MessageData<T, K>;
    timestamp: number;
}

export interface MessageProvider<T extends MessageDictionary, TOptions = void> {
    send<K extends MessageType<T>>(
        type: K,
        data: MessageData<T, K>,
        options?: TOptions
    ): Promise<MessageResponse<T, K>>;

    watch<K extends MessageType<T>>(type: K, handler: MessageTargetHandler<T, K>): () => void;

    watch(map: MessageMapHandler<T>): () => void;

    watch<K extends MessageType<T>>(general: MessageGeneralHandler<T, K>): () => void;
}

export interface MessageHandler<T extends MessageDictionary> {
    run(
        type: MessageType<T>,
        data: MessageData<T, MessageType<T>>,
        sender: MessageSender
    ): MessageResponse<T, MessageType<T>> | undefined | null;
}
