import {ContentScriptNode, ContentScriptBoundary, ContentScriptMountFunction} from "@typing/content";
import type ContainerRegistry from "../context/ContainerRegistry";

export default class MountNode implements ContentScriptNode {
    private unregister?: () => void;
    private cleanup?: () => void;
    private unmounting = false;

    constructor(
        protected node: ContentScriptNode,
        private readonly registry: ContainerRegistry,
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

    public get boundary(): ContentScriptBoundary {
        return this.node.boundary;
    }

    public mount(): boolean {
        if (this.unmounting) {
            return false;
        }

        this.node.mount();
        const container = this.container;

        if (!container || container.isConnected || !this.mounter) {
            return false;
        }

        this.unregister?.();
        const unregister = this.registry.register(container, this.anchor);
        this.unregister = unregister;

        try {
            const cleanup = this.mounter(this.anchor, container);

            if (this.unregister !== unregister || this.container !== container) {
                // A synchronous cancellation must not retain cleanup or revive the registration.
                cleanup?.();

                return false;
            }

            this.cleanup = cleanup || undefined;

            return true;
        } catch (error) {
            unregister();

            if (this.unregister === unregister) {
                this.unregister = undefined;
            }

            throw error;
        }
    }

    public unmount(): boolean {
        if (this.unmounting) {
            return false;
        }

        const unregister = this.unregister;
        const cleanup = this.cleanup;
        this.unregister = undefined;
        this.cleanup = undefined;
        this.unmounting = true;
        let removed = false;

        try {
            unregister?.();

            try {
                cleanup?.();
            } finally {
                removed = !!this.node.unmount();
            }
        } finally {
            this.unmounting = false;
        }

        return removed;
    }
}
