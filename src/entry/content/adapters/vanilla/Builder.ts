import {isValidContentScriptRenderValue} from "../../core/resolvers";

import MountBuilder from "../../core/MountBuilder";
import EventNode from "../../core/EventNode";
import VanillaNode from "./Node";

import {ContentScriptDefinition, ContentScriptNode} from "@typing/content";

export default class extends MountBuilder {
    public constructor(definition: ContentScriptDefinition) {
        super(definition);
    }

    protected async createNode(anchor: Element): Promise<ContentScriptNode> {
        let value = await this.getValue(anchor);

        if (value !== true && !isValidContentScriptRenderValue(value)) {
            value = undefined;

            console.warn("Content script vanilla value is not a valid render value");
        }

        return new EventNode(new VanillaNode(await super.createNode(anchor), value), this.emitter);
    }
}
