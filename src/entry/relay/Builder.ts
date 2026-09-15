import {resolveContentScriptIsolation} from "@shared/content";

import TransportBuilder from "./TransportBuilder";

import EntrypointBuilder from "../core/Builder";

import {RelayUnresolvedDefinition} from "@typing/relay";
import {ContentScriptBuilder, ContentScriptDefinition, ContentScriptIsolation} from "@typing/content";
import {TransportType} from "@typing/transport";

export default class Builder<
    T extends TransportType,
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> extends EntrypointBuilder {
    private generation = 0;

    protected readonly _transport: TransportBuilder<T, Data, Isolation>;
    protected readonly _content: ContentScriptBuilder;

    constructor(
        protected readonly definition: RelayUnresolvedDefinition<T, Data, Isolation>,
        contentBuilder: new (definition: ContentScriptDefinition<Data, NoInfer<Isolation>>) => ContentScriptBuilder
    ) {
        super();

        this._transport = new TransportBuilder(definition);

        const {init, main, name, method, allFrames, ...contentOptions} = definition;

        this._content = new contentBuilder({
            ...contentOptions,
            ...(allFrames === undefined ? {} : {allFrames: allFrames !== false}),
        } as ContentScriptDefinition<Data, Isolation>);
    }

    public async build(): Promise<void> {
        const destroying = this.destroy();
        const generation = this.generation;
        await destroying;

        if (generation !== this.generation) {
            return;
        }

        await this._transport.build();

        if (generation !== this.generation) {
            return;
        }

        await this._content.build();

        if (generation !== this.generation) {
            return;
        }

        const {prepare, boundary, target, ...options} = this.definition;
        const {main} = options;

        if (main) {
            await main(this._transport.get(), this._content.getContext(), {
                ...options,
                isolation: resolveContentScriptIsolation(this.definition.isolation, "render" in this.definition),
            });
        }
    }

    public async destroy(): Promise<void> {
        this.generation++;
        // Invalidate pending content work immediately; transport cleanup starts first.
        await Promise.all([this._transport.destroy(), this._content.destroy()]);
    }
}
