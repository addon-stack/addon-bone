import type IsolationSetup from "../IsolationSetup";

import {getContentScriptStylesRuntime} from "./isolated-styles";

import {
    ContentScriptShadowMode,
    type ContentScriptShadowOptions,
    type ContentScriptStylesRuntime,
    type ContentScriptNode,
    type ContentScriptBoundaryCleanup,
} from "@typing/content";

export default class ShadowNode<Data = unknown> implements ContentScriptNode {
    private root?: ShadowRoot;

    private _target?: Element;

    private runtime?: ContentScriptStylesRuntime;
    private cleanupBoundary?: ContentScriptBoundaryCleanup;

    private mounting = false;
    private unmounting = false;

    public constructor(
        protected readonly node: ContentScriptNode,
        private readonly options: ContentScriptShadowOptions = {},
        private readonly isolation: IsolationSetup<Data, "shadow">
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

    public get boundary(): ShadowRoot | undefined {
        return this.root;
    }

    public ready(): Promise<void> {
        return this.root && this.runtime ? this.runtime.ready(this.root) : Promise.resolve();
    }

    public mount(): boolean {
        if (this.mounting || this.unmounting) {
            return false;
        }

        this.mounting = true;

        try {
            return this.mountNode();
        } finally {
            this.mounting = false;
        }
    }

    private mountNode(): boolean {
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

        this.root = root;

        try {
            const cleanup = this.isolation.setup(root);

            if (this.root !== root) {
                cleanup?.();

                return false;
            }

            this.cleanupBoundary = cleanup || undefined;
            const target = this.isolation.createTarget(root, this.container.ownerDocument);

            if (this.root !== root) {
                return false;
            }

            root.appendChild(target);

            this._target = target;
            this.runtime = getContentScriptStylesRuntime();
            this.runtime.add(root, target);
        } catch (error) {
            if (this.root === root) {
                this.unmount();
            }

            throw error;
        }

        return mounted;
    }

    public unmount(): boolean {
        if (this.unmounting) {
            return false;
        }

        this.unmounting = true;
        this._target = undefined;

        const cleanup = this.cleanupBoundary;

        this.cleanupBoundary = undefined;

        let removed = false;

        try {
            try {
                cleanup?.();
            } finally {
                try {
                    if (this.root) {
                        this.runtime?.delete(this.root);
                    }
                } finally {
                    this.root = undefined;
                    this._target = undefined;
                    this.runtime = undefined;
                    removed = !!this.node.unmount();
                }
            }

            return removed;
        } finally {
            this.unmounting = false;
        }
    }
}
