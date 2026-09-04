import {getUrl} from "@addon-core/browser";

import {getEntrypointAssets} from "@main/entrypoint";

import {getShadowStylesRuntime, type ShadowStylesRuntime} from "./shadow-styles";

import type {ContentScriptNode} from "@typing/content";

export default class ShadowNode implements ContentScriptNode {
    private root?: ShadowRoot;

    private _target?: Element;

    private runtime?: ShadowStylesRuntime;

    public constructor(protected readonly node: ContentScriptNode) {}

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

        const root = this.container.attachShadow({mode: "open"});
        const target = document.createElement("div");
        root.appendChild(target);

        const runtime = getShadowStylesRuntime();
        const initialStyles = getEntrypointAssets().initial.css.map(file => getUrl(file));

        runtime.add(root, target, initialStyles);

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
