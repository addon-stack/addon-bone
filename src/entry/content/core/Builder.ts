import AwaitLock from "await-lock";

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
import AttributeMarker from "./AttributeMarker";
import WeakMarker from "./WeakMarker";

import {
    ContentScriptAnchor,
    ContentScriptAnchorGetter,
    ContentScriptBuilder,
    ContentScriptContainerCreator,
    ContentScriptContainerFactory,
    ContentScriptContainerOptions,
    ContentScriptContainerTag,
    ContentScriptContext,
    ContentScriptDefinition,
    ContentScriptMarker,
    ContentScriptMarkerContract,
    ContentScriptMarkerGetter,
    ContentScriptMarkerResolver,
    ContentScriptMarkerType,
    ContentScriptMountFunction,
    ContentScriptNode,
    ContentScriptOptions,
    ContentScriptRenderHandler,
    ContentScriptRenderValue,
    ContentScriptResolvedDefinition,
    ContentScriptWatchStrategy,
} from "@typing/content";

import {Awaiter} from "@typing/helpers";

export default abstract class extends Builder implements ContentScriptBuilder {
    private readonly lock: AwaitLock = new AwaitLock();

    protected readonly definition: ContentScriptResolvedDefinition;

    protected readonly emitter = new EventEmitter();

    protected readonly context = new ManagedContext(this.emitter);

    protected marker: ContentScriptMarkerContract = new AttributeMarker();

    protected unwatch?: () => void;

    protected abstract createNode(anchor: Element): Promise<ContentScriptNode>;

    protected abstract cleanupNode(anchor: Element): Awaiter<void>;

    protected constructor(definition: ContentScriptDefinition) {
        super();

        this.definition = {
            ...definition,
            marker: this.resolveMarker(definition.marker),
            anchor: this.resolveAnchor(definition.anchor),
            mount: this.resolveMount(definition.mount),
            container: this.resolveContainer(definition.container),
            render: this.resolveRender(definition.render),
            watch: this.resolveWatch(definition.watch),
        };
    }

    protected resolveMarker(marker: ContentScriptMarkerType | ContentScriptMarkerGetter): ContentScriptMarkerResolver {
        return async (options: ContentScriptOptions) => {
            if (typeof marker === "function") {
                marker = await marker(options);
            }

            if (!marker) {
                marker = ContentScriptMarker.Attribute;
            }

            if (typeof marker === "string") {
                switch (marker) {
                    case ContentScriptMarker.Weak:
                        return new WeakMarker();

                    case ContentScriptMarker.Attribute:
                    default:
                        return new AttributeMarker();
                }
            }

            if (typeof marker !== "object") {
                throw new Error(`The content script marker must be either a string ("attribute" | "weak") or an object implementing ContentScriptMarkerContract. Received: "${typeof marker}".`);
            }

            return marker;
        };
    }

    protected resolveAnchor(anchor?: ContentScriptAnchor | ContentScriptAnchorGetter): ContentScriptAnchorGetter {
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

        const {render, main, anchor, marker, container, watch, mount, ...options} = this.definition;

        this.marker = await marker(options);

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

        this.marker.reset();
    }

    protected async processing(): Promise<void> {
        await this.lock.acquireAsync();

        try {
            const anchor = await this.definition.anchor();

            const anchors = this.marker.for(anchor).unmarked();

            await Promise.allSettled(anchors.map(this.processAnchor.bind(this)));
        } finally {
            this.lock.release();
        }
    }

    protected async processAnchor(anchor: Element): Promise<void> {
        const node = await this.createNode(anchor);

        this.context.add(node);

        await this.cleanupNode(anchor);

        node.mount();
    }
}
