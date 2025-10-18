import {ContentScriptMarkerContract, ContentScriptNode} from "@typing/content";

export default class implements ContentScriptNode {
    constructor(
        protected readonly node: ContentScriptNode,
        protected readonly marker: ContentScriptMarkerContract
    ) {}

    public get anchor(): Element {
        return this.node.anchor;
    }

    public get container(): Element | undefined {
        return this.node.container;
    }

    public mount(): boolean | undefined | void {
        this.marker.mount(this.anchor);

        return this.node.mount();
    }

    public unmount(): boolean | undefined | void {
        this.marker.unmount(this.anchor);

        return this.node.unmount();
    }
}
