import {isContentScriptFrameNavigation, resolveContentScriptIsolation} from "@shared/content";
import AwaitLock from "await-lock";

import EntrypointBuilder from "@entry/core/Builder";

import {
    createAnchorResolver,
    createAwaitFirstStrategy,
    createContainerResolver,
    createTargetResolver,
    withLocationTracking,
    createAppendMountHandler,
    createMutationObserverStrategy,
} from "../resolvers";

import {ManagedContext, EventEmitter} from "./context";
import {AttributeMarker, WeakMarker} from "./markers";
import {EventNode} from "./nodes";

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
    ContentScriptIsolation,
    ContentScriptMarker,
    ContentScriptMarkerContract,
    ContentScriptMarkerGetter,
    ContentScriptMarkerResolver,
    ContentScriptMarkerType,
    ContentScriptMountFunction,
    ContentScriptNode,
    ContentScriptPrepareProps,
    ContentScriptOptions,
    ContentScriptRenderHandler,
    ContentScriptRenderValue,
    ContentScriptResolvedDefinition,
    ContentScriptWatchStrategy,
} from "@typing/content";

export default abstract class Builder<
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
>
    extends EntrypointBuilder
    implements ContentScriptBuilder
{
    private lock = new AwaitLock();

    protected generation = 0;

    protected readonly definition: ContentScriptResolvedDefinition<Data>;

    protected readonly emitter = new EventEmitter();

    protected readonly context = new ManagedContext(this.emitter);

    protected marker: ContentScriptMarkerContract = new AttributeMarker();

    protected unwatch?: () => void;

    protected abstract createNode(anchor: Element, data: Data, enabled: boolean): Promise<ContentScriptNode>;

    protected constructor(input: ContentScriptDefinition<Data, Isolation>) {
        super();

        // Normalization selects the isolation at runtime; its node supplies the matching callback props.
        const definition = input as ContentScriptDefinition<Data>;
        const isolation = resolveContentScriptIsolation(definition.isolation, "render" in definition);

        if (definition.boundary !== undefined) {
            if (typeof definition.boundary !== "function") {
                throw new Error("Content script boundary must be a synchronous setup handler");
            }

            if (isolation.type === "none") {
                throw new Error("Content script boundary requires Shadow DOM or an iframe");
            }
        }

        if (
            definition.target !== undefined &&
            (isolation.type === "none" || isContentScriptFrameNavigation(isolation))
        ) {
            throw new Error("Content script target requires Shadow DOM or an iframe with local rendering");
        }

        this.definition = {
            ...definition,
            marker: this.resolveMarker(definition.marker),
            anchor: this.resolveAnchor(definition.anchor),
            mount: this.resolveMount(definition.mount),
            container: this.resolveContainer(definition.container),
            target: createTargetResolver(definition.target),
            render: definition.render === true ? true : this.resolveRender(definition.render),
            isolation,
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

            return marker;
        };
    }

    protected resolveAnchor(anchor?: ContentScriptAnchor | ContentScriptAnchorGetter): ContentScriptAnchorGetter {
        return createAnchorResolver(anchor);
    }

    protected resolveMount(mount?: ContentScriptMountFunction): ContentScriptMountFunction {
        return mount || createAppendMountHandler();
    }

    protected resolveContainer(
        container?: ContentScriptContainerTag | ContentScriptContainerOptions | ContentScriptContainerFactory<Data>
    ): ContentScriptContainerCreator<Data> {
        return createContainerResolver(container);
    }

    protected resolveRender(
        render?: ContentScriptRenderValue<Data> | ContentScriptRenderHandler<Data>
    ): ContentScriptRenderHandler<Data> | undefined {
        if (render !== undefined) {
            throw new Error("Content script rendering requires a renderer adapter");
        }

        return undefined;
    }

    protected resolveWatch(watch?: true | ContentScriptWatchStrategy): ContentScriptWatchStrategy {
        if (watch === undefined) {
            watch = createAwaitFirstStrategy();
        } else if (watch === true) {
            watch = createMutationObserverStrategy();
        }

        return withLocationTracking(watch);
    }

    public getContext(): ContentScriptContext {
        return this.context;
    }

    public async build(): Promise<void> {
        const destroying = this.destroy();
        const generation = this.generation;
        await destroying;

        if (generation !== this.generation) {
            return;
        }

        const {render, prepare, main, anchor, marker, container, boundary, target, watch, mount, ...options} =
            this.definition;

        const resolvedMarker = await marker(options);

        if (generation !== this.generation) {
            return;
        }

        this.marker = resolvedMarker;

        await main?.(this.context, options);

        if (generation !== this.generation) {
            return;
        }

        if (
            render !== undefined ||
            prepare !== undefined ||
            isContentScriptFrameNavigation(this.definition.isolation)
        ) {
            await this.processing(generation);

            if (generation !== this.generation) {
                return;
            }

            this.unwatch = watch(async () => {
                if (generation !== this.generation) {
                    return;
                }

                try {
                    this.context.mount();
                    await this.processing(generation);
                } catch (error) {
                    console.error("Content script processing on watch error", error);
                }
            }, this.context);
        }
    }

    public async destroy(): Promise<void> {
        this.generation++;
        this.lock = new AwaitLock();

        this.unwatch?.();
        this.unwatch = undefined;

        this.context.clear();
        this.context.unwatch();
        this.marker.reset();
    }

    protected getPrepareProps(anchor: Element): ContentScriptPrepareProps {
        const {
            anchor: _,
            marker,
            mount,
            watch,
            prepare,
            render,
            container,
            boundary,
            target,
            main,
            ...options
        } = this.definition;

        return {...options, anchor};
    }

    protected async processing(generation: number): Promise<void> {
        const lock = this.lock;
        await lock.acquireAsync();

        try {
            if (generation !== this.generation) {
                return;
            }

            const anchor = await this.definition.anchor();

            if (generation !== this.generation) {
                return;
            }

            const anchors = this.marker
                .for(anchor)
                .unmarked()
                .filter(anchor => anchor.isConnected);

            const results = await Promise.allSettled(anchors.map(anchor => this.processAnchor(anchor, generation)));
            const errors = results.flatMap(result => (result.status === "rejected" ? [result.reason] : []));

            if (errors.length && generation === this.generation) {
                console.error(new AggregateError(errors, "Content script anchor processing failed"));
            }
        } finally {
            lock.release();
        }
    }

    protected async processAnchor(anchor: Element, generation: number): Promise<void> {
        const current = () => generation === this.generation && anchor.isConnected;
        const data = await this.definition.prepare?.(this.getPrepareProps(anchor));

        if (!current()) {
            return;
        }

        const node = new EventNode(await this.createNode(anchor, data as Data, data !== false), this.emitter);

        if (!current()) {
            node.unmount();

            return;
        }

        this.context.add(node);

        if (generation !== this.generation) {
            return;
        }

        try {
            node.mount();

            if (!current() && !node.container?.isConnected) {
                this.context.remove(node);
            }
        } catch (error) {
            this.context.remove(node);
            throw error;
        }
    }
}
