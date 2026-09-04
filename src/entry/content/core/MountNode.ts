import {ContentScriptMountFunction, ContentScriptNode} from "@typing/content";

export default class implements ContentScriptNode {
    private unmounting?: () => void;

    constructor(
        protected node: ContentScriptNode,
        protected mounter?: ContentScriptMountFunction
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

        if (!this.container || this.container.isConnected) {
            return false;
        }

        if (this.mounter) {
            const unmounting = this.mounter(this.anchor, this.container);

            if (unmounting) {
                this.unmounting = unmounting;
            }

            return true;
        }

        return false;
    }

    public unmount(): boolean {
        this.unmounting?.();
        this.unmounting = undefined;

        return !!this.node.unmount();
    }
}
