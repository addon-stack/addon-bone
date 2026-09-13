import {
    ContentScriptContext,
    ContentScriptEventCallback,
    ContentScriptEventEmitter,
    ContentScriptNode,
    ContentScriptNodeSet,
} from "@typing/content";

export default class implements ContentScriptContext {
    protected readonly collection: ContentScriptNodeSet = new Set();

    constructor(protected readonly emitter: ContentScriptEventEmitter) {}

    public get nodes(): ReadonlySet<ContentScriptNode> {
        return this.collection;
    }

    public mount(): void {
        for (const node of this.collection) {
            if (!node.anchor.isConnected) {
                node.unmount();

                this.collection.delete(node);

                this.emitter.emitRemove(node);

                continue;
            }

            node.mount();
        }
    }

    public unmount(): void {
        for (const node of this.collection) {
            node.unmount();

            if (!node.anchor.isConnected) {
                this.collection.delete(node);

                this.emitter.emitRemove(node);
            }
        }
    }

    public clear(): void {
        for (const node of this.collection) {
            node.unmount();
            this.collection.delete(node);
            this.emitter.emitRemove(node);
        }
    }

    public watch(callback: ContentScriptEventCallback): () => void {
        this.emitter.on(callback);

        return () => {
            this.emitter.off(callback);
        };
    }

    public unwatch(): void {
        this.emitter.removeAllListeners();
    }
}
