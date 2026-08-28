import RegisterTransport from "@transport/RegisterTransport";

import {isSandbox} from "../utils";
import SandboxManager from "../SandboxManager";
import SandboxMessage from "../SandboxMessage";
import {SandboxInner} from "../ports";

import type {TransportDictionary, TransportName, TransportReceiver} from "@typing/transport";

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

    protected message(): TransportReceiver {
        return new SandboxMessage(this.name, new SandboxInner(this.name));
    }

    protected manager() {
        return SandboxManager.getInstance();
    }

    public get(): T {
        if (!isSandbox()) {
            throw new Error(`Sandbox "${this.name}" can be getting only from sandbox context.`);
        }

        return super.get();
    }
}
