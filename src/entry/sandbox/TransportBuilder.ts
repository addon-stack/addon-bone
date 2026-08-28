import AbstractBuilder from "@entry/transport/AbstractBuilder";

import {RegisterSandbox} from "@sandbox/providers";

import type {SandboxOptions, SandboxUnresolvedDefinition} from "@typing/sandbox";
import type {TransportName, TransportType} from "@typing/transport";

export default class<T extends TransportType = TransportType> extends AbstractBuilder<SandboxOptions, T> {
    constructor(definition: SandboxUnresolvedDefinition<T>) {
        super(definition);
    }

    protected transport(): RegisterSandbox<TransportName, T, [SandboxOptions]> {
        const {name, init} = this.definition;

        return new RegisterSandbox(name, init);
    }
}
