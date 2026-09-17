import type ContainerRegistry from "./ContainerRegistry";

import {
    ContentScriptNode,
    ContentScriptContext,
    ContentScriptEventCallback,
    ContentScriptEventEmitter,
} from "@typing/content";

export default class Context implements ContentScriptContext {
    protected readonly collection = new Set<ContentScriptNode>();
    private unmounting = false;

    constructor(
        protected readonly emitter: ContentScriptEventEmitter,
        private readonly registry: ContainerRegistry
    ) {}

    public get nodes(): ReadonlySet<ContentScriptNode> {
        return this.collection;
    }

    public owns(target: Node): boolean {
        return this.registry.owns(target);
    }

    public mount(): void {
        if (this.unmounting) {
            return;
        }

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
        const unmounting = this.unmounting;
        this.unmounting = true;

        try {
            for (const node of this.collection) {
                node.unmount();

                if (!node.anchor.isConnected) {
                    this.collection.delete(node);

                    this.emitter.emitRemove(node);
                }
            }
        } finally {
            this.unmounting = unmounting;
        }
    }

    public remove(node: ContentScriptNode): void {
        if (!this.collection.delete(node)) {
            return;
        }

        try {
            node.unmount();
        } finally {
            this.emitter.emitRemove(node);
        }
    }

    public clear(): void {
        const unmounting = this.unmounting;

        this.unmounting = true;

        const errors: unknown[] = [];

        try {
            for (const node of this.collection) {
                try {
                    this.remove(node);
                } catch (error) {
                    errors.push(error);
                }
            }
        } finally {
            this.registry.clear();
            this.unmounting = unmounting;
        }

        if (errors.length > 0) {
            throw new AggregateError(errors, "Content script context cleanup failed");
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
