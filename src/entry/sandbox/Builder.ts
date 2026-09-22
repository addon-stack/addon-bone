import EntrypointBuilder from "@entry/core/Builder";

import TransportBuilder from "./TransportBuilder";

import {sandboxChannel} from "@sandbox/utils";

import {
    SandboxEntrypointOptions,
    SandboxGlobalAccess,
    SandboxReadyMessage,
    SandboxReadyMessageType,
    SandboxUnresolvedDefinition,
} from "@typing/sandbox";
import {TransportType} from "@typing/transport";
import {ViewBuilder, ViewBuilderConstructor} from "@typing/view";

export default class Builder<T extends TransportType = TransportType> extends EntrypointBuilder {
    protected readonly _transport: TransportBuilder<T>;

    protected readonly _view: ViewBuilder;

    private readonly name: string;

    constructor(
        definition: SandboxUnresolvedDefinition<T>,
        viewBuilder: ViewBuilderConstructor<SandboxEntrypointOptions>
    ) {
        super();

        this.name = definition.name!;
        this._transport = new TransportBuilder(definition);

        const {init, main, name, ...viewOptions} = definition;

        this._view = new viewBuilder(viewOptions);
    }

    public async build(): Promise<void> {
        await this.destroy();

        globalThis[SandboxGlobalAccess] = true;

        await this._transport.build();
        await this._view.build();

        this.ready();
    }

    public async destroy(): Promise<void> {
        await this._transport.destroy();
        await this._view.destroy();
    }

    private ready(): void {
        if (window.parent === window) {
            return;
        }

        window.parent.postMessage(
            {
                type: SandboxReadyMessageType,
                channel: sandboxChannel(this.name),
                name: this.name,
            } satisfies SandboxReadyMessage,
            "*"
        );
    }
}
