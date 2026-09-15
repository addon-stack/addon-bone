import type {
    ContentScriptBoundary,
    ContentScriptNode,
    ContentScriptProps,
    ContentScriptRenderHandler,
    ContentScriptRenderValue,
} from "@typing/content";

/** Runs the adapter only after mounting DOM, and invalidates work when its target is replaced. */
export default abstract class RenderNode<Data = unknown> implements ContentScriptNode {
    private generation = 0;
    private renderedTarget?: Element;
    private empty = false;

    constructor(
        protected readonly node: ContentScriptNode,
        private readonly resolve: ContentScriptRenderHandler<Data>,
        private readonly props: () => ContentScriptProps<Data>
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

    public mount(): boolean {
        if (this.empty || !this.anchor.isConnected) {
            return false;
        }

        this.node.mount();

        const target = this.target;

        if (!target) {
            return false;
        }

        if (target === this.renderedTarget) {
            return false;
        }

        this.clear();

        const generation = ++this.generation;

        this.renderedTarget = target;
        const replacedAnchor = !this.anchor.isConnected;

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

        this.clear();

        return !!this.node.unmount();
    }
}
