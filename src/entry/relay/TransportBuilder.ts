import AbstractBuilder from "@entry/transport/AbstractBuilder";

import {RegisterRelay} from "@relay/providers";

import {RelayOptions, RelayUnresolvedDefinition, RelayMethod} from "@typing/relay";
import {TransportName, TransportType} from "@typing/transport";

export default class<T extends TransportType = TransportType> extends AbstractBuilder<RelayOptions, T> {
    protected readonly method: RelayMethod;

    constructor(definition: RelayUnresolvedDefinition<T>) {
        const {main, method, ...options} = definition;

        super(options);

        this.method = method || RelayMethod.Scripting;
    }

    protected transport(): RegisterRelay<TransportName, T, [RelayOptions]> {
        const {name, init} = this.definition;

        return new RegisterRelay(name, this.method, init);
    }
}
