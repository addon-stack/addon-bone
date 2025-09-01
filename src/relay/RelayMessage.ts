import TransportMessage from "@transport/TransportMessage";

import {MessageTypeSeparator} from "@typing/message";

export default class RelayMessage extends TransportMessage {
    protected readonly key: string;

    constructor(name: string) {
        super();
        this.key = `relay${MessageTypeSeparator}${name}`;
    }
}
