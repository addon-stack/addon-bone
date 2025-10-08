import {isBackground} from "@addon-core/browser";

import RegisterTransport from "@transport/RegisterTransport";

import ServiceMessage from "../ServiceMessage";
import ServiceManager from "../ServiceManager";

import {TransportDictionary, TransportManager, TransportMessage, TransportName} from "@typing/transport";

export default class<
    N extends TransportName,
    T extends object = TransportDictionary[N],
    A extends any[] = [],
> extends RegisterTransport<N, T, A> {
    constructor(
        name: N,
        protected readonly init: (...args: A) => T
    ) {
        super(name, init);
    }

    protected message(): TransportMessage {
        return new ServiceMessage(this.name);
    }

    protected manager(): TransportManager {
        return ServiceManager.getInstance();
    }

    public get(): T {
        if (!isBackground()) {
            throw new Error(`Service "${this.name}" can be getting only from background context.`);
        }

        return super.get();
    }
}
