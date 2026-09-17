import Context from "./Context";
import ContainerRegistry from "./ContainerRegistry";
import type {ContentScriptNode, ContentScriptEventEmitter} from "@typing/content";

export default class ManagedContext extends Context {
    public readonly containers: ContainerRegistry;

    constructor(emitter: ContentScriptEventEmitter) {
        const containers = new ContainerRegistry();
        super(emitter, containers);
        this.containers = containers;
    }

    public add(node: ContentScriptNode): this {
        this.collection.add(node);

        this.emitter.emitAdd(node);

        return this;
    }
}
