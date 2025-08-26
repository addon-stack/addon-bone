import {Message} from "@message/providers";

import {MessageDictionary, MessageProvider, MessageSender, MessageSendOptions} from "@typing/message";
import type {TransportMessage as TransportMessageContract, TransportMessageData} from "@typing/transport";

export default abstract class TransportMessage implements TransportMessageContract {
    protected message: MessageProvider<MessageDictionary, MessageSendOptions> = new Message();

    protected abstract readonly key: string;

    public async send(data: TransportMessageData, options?: MessageSendOptions) {
        return this.message.send(this.key, data, options);
    }

    public watch(handler: (data: TransportMessageData, sender: MessageSender) => any): void {
        this.message.watch(this.key, handler);
    }
}
