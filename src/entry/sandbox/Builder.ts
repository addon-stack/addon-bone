import TransportBuilder from "./TransportBuilder";

import Builder from "../core/Builder";

import {sandboxChannel} from "@sandbox/utils";

import {
    SandboxGlobalAccess,
    SandboxReadyMessage,
    SandboxReadyMessageType,
    SandboxUnresolvedDefinition,
} from "@typing/sandbox";
import {TransportType} from "@typing/transport";
import {ViewBuilder} from "@typing/view";

export default class<T extends TransportType = TransportType> extends Builder {
    protected readonly _transport: TransportBuilder<T>;

    protected _view?: ViewBuilder;

    private readonly name: string;

    constructor(definition: SandboxUnresolvedDefinition<T>) {
        super();

        this.name = definition.name!;
        this._transport = new TransportBuilder(definition);
    }

    public view(view: ViewBuilder): this {
        this._view = view;

        return this;
    }

    public async build(): Promise<void> {
        await this.destroy();

        globalThis[SandboxGlobalAccess] = true;

        await this._transport.build();
        await this._view?.build();

        this.ready();
    }

    public async destroy(): Promise<void> {
        await this._transport.destroy();
        await this._view?.destroy();
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
