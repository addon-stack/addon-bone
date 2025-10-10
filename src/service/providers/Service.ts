import {isBackground} from "@addon-core/browser";

import BaseTransport from "@transport/BaseTransport";

import ServiceManager from "../ServiceManager";

import type {TransportDictionary, TransportManager, TransportName} from "@typing/transport";

export default class<N extends TransportName, T = TransportDictionary[N]> extends BaseTransport<N, T> {
    constructor(name: N) {
        super(name);
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
