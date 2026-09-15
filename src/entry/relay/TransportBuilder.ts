import AbstractBuilder from "@entry/transport/AbstractBuilder";

import {RegisterRelay} from "@relay/providers";

import {RelayOptions, RelayUnresolvedDefinition, RelayMethod} from "@typing/relay";
import {TransportName, TransportType} from "@typing/transport";
import type {ContentScriptIsolation} from "@typing/content";

export default class TransportBuilder<
    T extends TransportType = TransportType,
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> extends AbstractBuilder<RelayOptions, T> {
    protected readonly method: RelayMethod;

    constructor(definition: RelayUnresolvedDefinition<T, Data, Isolation>) {
        const {main, method, prepare, boundary, target, ...options} = definition;

        super(options);

        this.method = method || RelayMethod.Messaging;
    }

    protected transport(): RegisterRelay<TransportName, T, [RelayOptions]> {
        const {name, init} = this.definition;

        return new RegisterRelay(name, this.method, init);
    }
}
