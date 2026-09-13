import {
    ContentScriptEvent,
    ContentScriptEventCallback,
    ContentScriptEventEmitter,
    ContentScriptNode,
} from "@typing/content";

export default class implements ContentScriptEventEmitter {
    private readonly listeners: Set<ContentScriptEventCallback> = new Set();

    public emit(event: ContentScriptEvent, node: ContentScriptNode): void {
        for (const listener of this.listeners) {
            listener(event, node);
        }
    }

    public emitAdd(node: ContentScriptNode): void {
        this.emit(ContentScriptEvent.Add, node);
    }

    public emitMount(node: ContentScriptNode): void {
        this.emit(ContentScriptEvent.Mount, node);
    }

    public emitRemove(node: ContentScriptNode): void {
        this.emit(ContentScriptEvent.Remove, node);
    }

    public emitUnmount(node: ContentScriptNode): void {
        this.emit(ContentScriptEvent.Unmount, node);
    }

    public hasListeners(): boolean {
        return this.listenerCount() > 0;
    }

    public listenerCount(): number {
        return this.listeners.size;
    }

    public off(callback: ContentScriptEventCallback): void {
        this.listeners.delete(callback);
    }

    public on(callback: ContentScriptEventCallback): void {
        this.listeners.add(callback);
    }

    public removeAllListeners(): void {
        this.listeners.clear();
    }
}
