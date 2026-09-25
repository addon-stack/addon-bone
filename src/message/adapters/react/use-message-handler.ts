import {useCallback, useLayoutEffect, useRef} from "react";
import {MessageDictionary, MessageTargetHandler, MessageType} from "@typing/message";

import {Message} from "@message/providers";

export default function useMessageHandler<K extends MessageType<T>, T extends MessageDictionary = MessageDictionary>(
    type: K,
    handler: MessageTargetHandler<T, K>
): void {
    const messageRef = useRef<Message<T> | null>(null);

    if (!messageRef.current) {
        messageRef.current = Message.getInstance<T>();
    }

    const handlerRef = useRef(handler);

    useLayoutEffect(() => {
        // A suspended or abandoned render must not replace the active handler.
        handlerRef.current = handler;
    }, [handler]);

    const stableWrapper = useCallback<MessageTargetHandler<T, K>>((data, sender) => {
        return handlerRef.current(data, sender);
    }, []);

    useLayoutEffect(() => {
        return messageRef.current!.watch(type, stableWrapper);
    }, [type, stableWrapper]);
}
