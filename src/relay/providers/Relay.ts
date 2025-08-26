import BaseTransport from "@transport/BaseTransport";

import {TransportDictionary, TransportManager, TransportName} from "@typing/transport";

import RelayManager from "../RelayManager";
import {isContentScript} from "../utils";

export default class<N extends TransportName, T = TransportDictionary[N]> extends BaseTransport<N, T> {
    constructor(name: N) {
        super(name);
    }

    protected manager(): TransportManager {
        return RelayManager.getInstance();
    }

    public get(): T {
        if (!isContentScript()) {
            throw new Error(`Relay "${this.name}" can be getting only from content script`);
        }

        return super.get();
    }
}
