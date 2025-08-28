import {Message} from "@message/providers";

import {
    MessageData,
    MessageDictionary,
    MessageGeneralHandler,
    MessageMapHandler,
    MessageResponse,
    MessageSenderAware,
    MessageTargetHandler,
    MessageType,
    MessageSender,
    MessageSendOptions,
} from "@typing/message";

export type {
    MessageData,
    MessageDictionary,
    MessageGeneralHandler,
    MessageMapHandler,
    MessageResponse,
    MessageTargetHandler,
    MessageType,
    MessageSendOptions,
    MessageSenderAware,
    MessageSender,
};

export {Message};

export interface MessageRegistry extends MessageDictionary {}

export function sendMessage<K extends MessageType<MessageRegistry>>(
    type: K,
    data: MessageData<MessageRegistry, K>,
    options?: MessageSendOptions
): Promise<MessageResponse<MessageRegistry, K>> {
    return Message.getInstance<MessageRegistry>().send(type, data, options);
}

export function onMessage<K extends MessageType<MessageRegistry>>(
    type: K,
    handler: MessageTargetHandler<MessageRegistry, K>
): () => void;

export function onMessage<K extends MessageType<MessageRegistry>>(
    handler: MessageGeneralHandler<MessageRegistry, K>
): () => void;

export function onMessage(map: MessageMapHandler<MessageRegistry>): () => void;

export function onMessage<K extends MessageType<MessageRegistry>>(
    arg1: K | MessageMapHandler<MessageRegistry> | MessageGeneralHandler<MessageRegistry, K>,
    arg2?: MessageTargetHandler<MessageRegistry, K>
): () => void {
    return Message.getInstance<MessageRegistry>().watch(arg1, arg2);
}
