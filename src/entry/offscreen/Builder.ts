import TransportBuilder from "./TransportBuilder";

import Builder from "../core/Builder";

import {OffscreenGlobalAccess, OffscreenUnresolvedDefinition} from "@typing/offscreen";
import {TransportType} from "@typing/transport";
import {ViewBuilder} from "@typing/view";

export default class<T extends TransportType = TransportType> extends Builder {
    protected readonly _transport: TransportBuilder<T>;

    protected _view?: ViewBuilder;

    constructor(definition: OffscreenUnresolvedDefinition<T>) {
        super();

        this._transport = new TransportBuilder(definition);
    }

    public view(view: ViewBuilder): this {
        this._view = view;

        return this;
    }

    public async build(): Promise<void> {
        await this.destroy();

        globalThis[OffscreenGlobalAccess] = true;

        await this._transport.build();
        await this._view?.build();
    }

    public async destroy(): Promise<void> {
        await this._transport.destroy();
        await this._view?.destroy();
    }
}
