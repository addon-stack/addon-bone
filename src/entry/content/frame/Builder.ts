import MountBuilder from "../core/MountBuilder";
import EventNode from "../core/nodes/EventNode";
import type {ContentScriptDefinition, ContentScriptNode} from "@typing/content";

/** Page/src navigation has a document owner of its own and does not use a UI renderer. */
export default class Builder extends MountBuilder {
    public constructor(definition: ContentScriptDefinition) {
        super(definition);
    }

    protected async createNode(anchor: Element): Promise<ContentScriptNode> {
        return new EventNode(await super.createNode(anchor), this.emitter);
    }
}
