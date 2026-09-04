import {ContentScriptEventEmitter, ContentScriptNode} from "@typing/content";

export default class implements ContentScriptNode {
    constructor(
        protected readonly node: ContentScriptNode,
        protected readonly emitter: ContentScriptEventEmitter
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
        const result = this.node.mount();

        if (result === true) {
            this.emitter.emitMount(this.node);
        }

        return !!result;
    }

    public unmount(): boolean {
        const result = this.node.unmount();

        if (result === true) {
            this.emitter.emitUnmount(this.node);
        }

        return !!result;
    }
}
