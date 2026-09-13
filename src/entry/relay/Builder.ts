import {resolveContentScriptIsolation} from "@shared/content";

import TransportBuilder from "./TransportBuilder";

import Builder from "../core/Builder";

import {RelayUnresolvedDefinition} from "@typing/relay";
import {ContentScriptBuilder} from "@typing/content";
import {TransportType} from "@typing/transport";

export default class<T extends TransportType> extends Builder {
    protected readonly _transport: TransportBuilder<T>;
    protected _content?: ContentScriptBuilder;

    constructor(protected readonly definition: RelayUnresolvedDefinition<T>) {
        super();

        this._transport = new TransportBuilder(definition);
    }

    public content(content: ContentScriptBuilder): this {
        this._content = content;

        return this;
    }

    public async build(): Promise<void> {
        await this.destroy();

        await this._transport.build();
        await this._content?.build();

        const {main} = this.definition;

        if (main) {
            if (!this._content) {
                throw new Error("Content script builder not set");
            }

            await main(this._transport.get(), this._content.getContext(), {
                ...this.definition,
                isolation: resolveContentScriptIsolation(this.definition.isolation, "render" in this.definition),
            });
        }
    }

    public async destroy(): Promise<void> {
        await this._transport.destroy();
        await this._content?.destroy();
    }
}
