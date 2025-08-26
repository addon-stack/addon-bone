import RegisterTransport from "@transport/RegisterTransport";

import RelayMessage from "../RelayMessage";
import RelayManager from "../RelayManager";
import {isContentScript} from "../utils";

import {TransportDictionary, TransportManager, TransportMessage, TransportName} from "@typing/transport";
import {RelayMethod} from "@typing/relay";

export default class<
    N extends TransportName,
    T extends object = TransportDictionary[N],
    A extends any[] = [],
> extends RegisterTransport<N, T, A> {
    constructor(
        name: N,
        protected method: RelayMethod,
        protected readonly init: (...args: A) => T
    ) {
        super(name, init);
    }

    protected message(): TransportMessage {
        return new RelayMessage(this.name);
    }

    protected manager(): TransportManager {
        return RelayManager.getInstance();
    }

    public register(...args: A): T {
        if (this.method === RelayMethod.Scripting) {
            if (this.manager().has(this.name)) {
                throw new Error(`A relay with the name "${this.name}" already exists. The relay name must be unique.`);
            }

            const relay = this.init(...args);

            this.manager().add(this.name, relay);

            return relay;
        } else {
            return super.register(...args);
        }
    }

    public get(): T {
        if (!isContentScript()) {
            throw new Error(`Relay "${this.name}" can be getting only from content script`);
        }

        return super.get();
    }
}
