import {resolveContentScriptIsolation} from "@shared/content";

import TransportBuilder from "./TransportBuilder";

import EntrypointBuilder from "../core/Builder";

import {RelayUnresolvedDefinition} from "@typing/relay";
import {ContentScriptBuilder, ContentScriptDefinition} from "@typing/content";
import {TransportType} from "@typing/transport";

export default class Builder<T extends TransportType> extends EntrypointBuilder {
    protected readonly _transport: TransportBuilder<T>;
    protected readonly _content: ContentScriptBuilder;

    constructor(
        protected readonly definition: RelayUnresolvedDefinition<T>,
        contentBuilder: new (definition: ContentScriptDefinition) => ContentScriptBuilder
    ) {
        super();

        this._transport = new TransportBuilder(definition);

        const {init, main, name, method, allFrames, ...contentOptions} = definition;

        this._content = new contentBuilder({
            ...contentOptions,
            ...(allFrames === undefined ? {} : {allFrames: allFrames !== false}),
        } as ContentScriptDefinition);
    }

    public async build(): Promise<void> {
        await this.destroy();

        await this._transport.build();
        await this._content.build();

        const {main} = this.definition;

        if (main) {
            await main(this._transport.get(), this._content.getContext(), {
                ...this.definition,
                isolation: resolveContentScriptIsolation(this.definition.isolation, "render" in this.definition),
            });
        }
    }

    public async destroy(): Promise<void> {
        await this._transport.destroy();
        await this._content.destroy();
    }
}
