import {ContentScriptNode, ContentScriptBoundary, ContentScriptEventEmitter} from "@typing/content";
import type {ContentScriptMountNotifier} from "../types";

export default class EventNode implements ContentScriptNode {
    private generation = 0;

    constructor(
        protected readonly node: ContentScriptNode,
        protected readonly emitter: ContentScriptEventEmitter,
        private readonly notifier?: ContentScriptMountNotifier
    ) {
        notifier?.setMountHandler(() => {
            this.emitter.emitMount(this.node);
        });
    }

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
        const generation = this.generation;
        const result = this.node.mount();

        if (generation !== this.generation) {
            return false;
        }

        if (result === true && !this.notifier) {
            this.emitter.emitMount(this.node);
        }

        return !!result;
    }

    public unmount(): boolean {
        this.generation++;

        const result = this.node.unmount();

        if (result === true) {
            this.emitter.emitUnmount(this.node);
        }

        return !!result;
    }
}
