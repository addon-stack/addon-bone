import Builder from "@entry/core/Builder";

import {
    contentScriptAnchorResolver,
    contentScriptAwaitFirstResolver,
    contentScriptContainerResolver,
    contentScriptLocationResolver,
    contentScriptMountAppendResolver,
    contentScriptMutationObserverResolver,
    contentScriptRenderResolver,
} from "./resolvers";

import ManagedContext from "./ManagedContext";
import EventEmitter from "./EventEmitter";

import {
    ContentScriptAnchor,
    ContentScriptAnchorGetter,
    ContentScriptAnchorResolver,
    ContentScriptBuilder,
    ContentScriptContainerCreator,
    ContentScriptContainerFactory,
    ContentScriptContainerOptions,
    ContentScriptContainerTag,
    ContentScriptContext,
    ContentScriptDefinition,
    ContentScriptMountFunction,
    ContentScriptNode,
    ContentScriptRenderHandler,
    ContentScriptRenderValue,
    ContentScriptResolvedDefinition,
    ContentScriptWatchStrategy,
} from "@typing/content";

import {Awaiter} from "@typing/helpers";

export default abstract class extends Builder implements ContentScriptBuilder {
    protected readonly definition: ContentScriptResolvedDefinition;

    protected readonly emitter = new EventEmitter();

    protected readonly context = new ManagedContext(this.emitter);

    protected unwatch?: () => void;

    private isProcessing: boolean = false;

    protected abstract createNode(anchor: Element): Promise<ContentScriptNode>;

    protected abstract cleanupNode(anchor: Element): Awaiter<void>;

    protected constructor(definition: ContentScriptDefinition) {
        super();

        this.definition = {
            ...definition,
            anchor: this.resolveAnchor(definition.anchor),
            mount: this.resolveMount(definition.mount),
            container: this.resolveContainer(definition.container),
            render: this.resolveRender(definition.render),
            watch: this.resolveWatch(definition.watch),
        };
    }

    protected resolveAnchor(anchor?: ContentScriptAnchor | ContentScriptAnchorGetter): ContentScriptAnchorResolver {
        return contentScriptAnchorResolver(anchor);
    }

    protected resolveMount(mount?: ContentScriptMountFunction): ContentScriptMountFunction {
        return mount || contentScriptMountAppendResolver();
    }

    protected resolveContainer(
        container?: ContentScriptContainerTag | ContentScriptContainerOptions | ContentScriptContainerFactory
    ): ContentScriptContainerCreator {
        return contentScriptContainerResolver(container);
    }

    protected resolveRender(
        render?: ContentScriptRenderValue | ContentScriptRenderHandler
    ): ContentScriptRenderHandler | undefined {
        if (render === undefined) {
            return;
        }

        return contentScriptRenderResolver(render);
    }

    protected resolveWatch(watch?: true | ContentScriptWatchStrategy): ContentScriptWatchStrategy {
        if (watch === undefined) {
            watch = contentScriptAwaitFirstResolver();
        } else if (watch === true) {
            watch = contentScriptMutationObserverResolver();
        }

        return contentScriptLocationResolver(watch);
    }

    public getContext(): ContentScriptContext {
        return this.context;
    }

    public async build(): Promise<void> {
        await this.destroy();

        const {render, main, anchor, container, watch, mount, ...options} = this.definition;

        await main?.(this.context, options);

        if (render !== undefined) {
            await this.processing();

            this.unwatch = watch(() => {
                this.processing().catch(e => {
                    console.error("Content script processing on watch error", e);
                });
            }, this.context);
        }
    }

    public async destroy(): Promise<void> {
        this.unwatch?.();
        this.unwatch = undefined;
    }

    protected async processing(): Promise<void> {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;

        const anchors = await this.definition.anchor();

        await Promise.allSettled(anchors.map(this.processAnchor.bind(this)));

        this.isProcessing = false;
    }

    protected async processAnchor(anchor: Element): Promise<void> {
        const node = await this.createNode(anchor);

        this.context.add(node);

        await this.cleanupNode(anchor);

        node.mount();
    }
}
