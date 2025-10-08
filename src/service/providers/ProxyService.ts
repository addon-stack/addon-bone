import {isBackground} from "@addon-core/browser";

import ProxyTransport from "@transport/ProxyTransport";

import ServiceManager from "../ServiceManager";
import ServiceMessage from "../ServiceMessage";

import type {DeepAsyncProxy} from "@typing/helpers";
import type {TransportDictionary, TransportManager, TransportMessage, TransportName} from "@typing/transport";

export default class<N extends TransportName, T = DeepAsyncProxy<TransportDictionary[N]>> extends ProxyTransport<N, T> {
    protected message: TransportMessage;

    constructor(name: N) {
        super(name);
        this.message = new ServiceMessage(name);
    }

    protected manager(): TransportManager {
        return ServiceManager.getInstance();
    }

    protected async apply(args: any[], path?: string): Promise<any> {
        return this.message.send({path, args});
    }

    public get(): T {
        if (isBackground()) {
            throw new Error(
                `You are trying to get proxy service "${this.name}" from background. You can get original service instead`
            );
        }

        return super.get();
    }
}
