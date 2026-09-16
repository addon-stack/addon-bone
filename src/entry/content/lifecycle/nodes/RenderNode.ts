import type {
    ContentScriptBoundary,
    ContentScriptNode,
    ContentScriptProps,
    ContentScriptRenderHandler,
    ContentScriptRenderValue,
} from "@typing/content";
import type {ContentScriptRenderLifecycle, ContentScriptRenderOptions} from "../types";

/** Runs the adapter only after mounting DOM and invalidates work when its target is replaced. */
export default abstract class RenderNode<Data = unknown> implements ContentScriptNode, ContentScriptRenderLifecycle {
    private generation = 0;
    private renderedTarget?: Element;
    private pendingTarget?: Element;
    private mountHandler?: () => void;
    private errorHandler?: (error: unknown) => void;
    private empty = false;

    constructor(
        protected readonly node: ContentScriptNode,
        private readonly resolve: ContentScriptRenderHandler<Data>,
        private readonly props: () => ContentScriptProps<Data>,
        private readonly options?: ContentScriptRenderOptions
    ) {}

    public get anchor(): Element {
        return this.node.anchor;
    }

    public get container(): Element | undefined {
        return this.node.container;
    }

    public get target(): Element | undefined {
        return this.node.target;
    }

    public get boundary(): ContentScriptBoundary {
        return this.node.boundary;
    }

    protected abstract render(value: ContentScriptRenderValue<Data> | undefined, target: Element): boolean;

    protected abstract clear(): void;

    public setMountHandler(handler: () => void): void {
        this.mountHandler = handler;
    }

    public setErrorHandler(handler: (error: unknown) => void): void {
        this.errorHandler = handler;
    }

    public mount(): boolean {
        if (this.empty || !this.anchor.isConnected) {
            return false;
        }

        const ready = this.options?.ready;
        const onError = this.errorHandler;

        if (ready && !onError) {
            throw new Error("Deferred content rendering requires an error handler before mount");
        }

        this.node.mount();

        const target = this.target;

        if (!target) {
            return false;
        }

        if (target === this.renderedTarget || target === this.pendingTarget) {
            return false;
        }

        this.clear();

        const generation = ++this.generation;
        this.pendingTarget = undefined;

        const replacedAnchor = !this.anchor.isConnected;

        if (ready && onError) {
            const loading = ready();
            this.pendingTarget = target;

            void loading.then(
                () => {
                    if (generation !== this.generation || target !== this.target) {
                        return;
                    }

                    this.pendingTarget = undefined;

                    try {
                        this.completeRender(target, generation, replacedAnchor);
                    } catch (error) {
                        onError(error);
                    }
                },
                () => {
                    // The style runtime reports the failure. A later mount can retry this target.
                    if (generation === this.generation) {
                        this.pendingTarget = undefined;
                    }
                }
            );

            return false;
        }

        return this.completeRender(target, generation, replacedAnchor);
    }

    private completeRender(target: Element, generation: number, replacedAnchor: boolean): boolean {
        const rendered = this.renderTarget(target, generation, replacedAnchor);

        if (rendered && generation === this.generation && target === this.target) {
            this.mountHandler?.();
        }

        return rendered;
    }

    private renderTarget(target: Element, generation: number, replacedAnchor: boolean): boolean {
        if (generation !== this.generation || target !== this.target) {
            return false;
        }

        if (!this.anchor.isConnected && !(replacedAnchor && this.container?.isConnected)) {
            this.unmount();

            return false;
        }

        // Prevent a render callback from recursively rendering into the same target.
        this.renderedTarget = target;

        try {
            const value = this.resolve(this.props());

            if (generation !== this.generation || target !== this.target) {
                return false;
            }

            // A synchronous custom mount (including append: Replace) can deliberately replace its anchor.
            if (!this.anchor.isConnected && !(replacedAnchor && this.container?.isConnected)) {
                this.unmount();

                return false;
            }

            if (!this.render(value, target)) {
                this.empty = true;
                this.node.unmount();

                return false;
            }

            return true;
        } catch (error) {
            if (generation !== this.generation) {
                return false;
            }

            this.unmount();

            throw error;
        }
    }

    public unmount(): boolean {
        this.generation++;
        this.renderedTarget = undefined;
        this.pendingTarget = undefined;

        this.clear();

        return !!this.node.unmount();
    }
}
