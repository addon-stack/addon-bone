import {contentScriptAnchorAttribute} from "./resolvers";

import {ContentScriptNode} from "@typing/content";

enum NodeMark {
    Mounded = "1",
    Unmounted = "0",
}

export default class implements ContentScriptNode {
    private readonly _container?: Element;

    private readonly attr = contentScriptAnchorAttribute;

    constructor(
        public readonly anchor: Element,
        public container?: Element
    ) {
        if (this.container) {
            this._container = this.container.cloneNode(false) as Element;
        }
    }

    public mount(): boolean {
        this.mark();

        if (!this.container && this._container) {
            this.container = this._container.cloneNode(false) as Element;

            return true;
        }

        return false;
    }

    public unmount(): boolean {
        this.unmark();

        if (this.container) {
            this.container.remove();
            this.container = undefined;

            return true;
        }

        return false;
    }

    protected mark(): this {
        let id = this.anchor.getAttribute(this.attr);

        if (typeof id !== "string" || id.length === 0 || id === NodeMark.Unmounted) {
            this.anchor.setAttribute(this.attr, NodeMark.Mounded);
        }

        return this;
    }

    protected unmark(): void {
        this.anchor.setAttribute(this.attr, NodeMark.Unmounted);
    }
}
