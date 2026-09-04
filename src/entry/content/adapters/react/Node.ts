import {ReactNode as ReactComponent} from "react";
import {createRoot, Root} from "react-dom/client";

import {ContentScriptNode} from "@typing/content";

export default class implements ContentScriptNode {
    protected root?: Root;

    constructor(
        protected readonly node: ContentScriptNode,
        protected readonly component?: ReactComponent
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

    public mount(): boolean {
        this.node.mount();

        if (!this.target || this.root) {
            return false;
        }

        if (!this.component) {
            console.warn("Content script react component is empty");

            return false;
        }

        this.root = createRoot(this.target);

        this.root.render(this.component);

        return true;
    }

    public unmount(): boolean {
        this.root?.unmount();
        this.root = undefined;

        return !!this.node.unmount();
    }
}
