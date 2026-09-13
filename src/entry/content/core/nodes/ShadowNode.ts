import {getContentScriptStylesRuntime} from "./isolated-styles";
import {
    ContentScriptShadowMode,
    type ContentScriptShadowOptions,
    type ContentScriptStylesRuntime,
    type ContentScriptNode,
} from "@typing/content";

export default class ShadowNode implements ContentScriptNode {
    private root?: ShadowRoot;

    private _target?: Element;

    private runtime?: ContentScriptStylesRuntime;

    public constructor(
        protected readonly node: ContentScriptNode,
        private readonly options: ContentScriptShadowOptions = {}
    ) {}

    public get anchor(): Element {
        return this.node.anchor;
    }

    public get container(): Element | undefined {
        return this.node.container;
    }

    public get target(): Element | undefined {
        return this._target;
    }

    public mount(): boolean {
        const mounted = !!this.node.mount();

        if (!this.container || this.root) {
            return mounted;
        }

        if (!("attachShadow" in this.container) || typeof this.container.attachShadow !== "function") {
            throw new Error("Content script container does not support Shadow DOM");
        }

        if (this.container.shadowRoot) {
            throw new Error("Content script container already has an open ShadowRoot");
        }

        let root: ShadowRoot;
        try {
            root = this.container.attachShadow({mode: this.options.mode ?? ContentScriptShadowMode.Open});
        } catch (cause) {
            // A pre-existing closed root is not observable through container.shadowRoot.
            throw new Error(
                "Cannot attach ShadowRoot: the content script container may already have a root or not support Shadow DOM",
                {cause}
            );
        }
        const target = this.container.ownerDocument.createElement("div");
        root.appendChild(target);

        const runtime = getContentScriptStylesRuntime();
        runtime.add(root, target);

        this.root = root;
        this._target = target;
        this.runtime = runtime;

        return mounted;
    }

    public unmount(): boolean {
        if (this.root) {
            this.runtime?.delete(this.root);
        }

        this.root = undefined;
        this._target = undefined;
        this.runtime = undefined;

        return !!this.node.unmount();
    }
}
