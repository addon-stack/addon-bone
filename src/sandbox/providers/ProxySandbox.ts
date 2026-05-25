import ProxyTransport from "@transport/ProxyTransport";

import SandboxManager from "../SandboxManager";
import SandboxMessage from "../SandboxMessage";

import type {DeepAsyncProxy} from "@typing/helpers";
import type {SandboxParameters} from "@typing/sandbox";
import type {TransportDictionary, TransportManager, TransportName} from "@typing/transport";

export default class<N extends TransportName, T = DeepAsyncProxy<TransportDictionary[N]>> extends ProxyTransport<N, T> {
    constructor(
        name: N,
        private readonly parameters: SandboxParameters
    ) {
        super(name);
    }

    protected manager(): TransportManager {
        return SandboxManager.getInstance();
    }

    protected apply(args: any[], path?: string): Promise<any> {
        return SandboxMessage.for(this.name, this.parameters).send({path, args});
    }
}
