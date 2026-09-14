import {createRenderResolver, isValidRenderValue} from "./resolvers/render";

import MountBuilder from "../../lifecycle/MountBuilder";
import VanillaNode from "./Node";

import type {
    ContentScriptDefinition,
    ContentScriptNode,
    ContentScriptRenderHandler,
    ContentScriptRenderValue,
} from "@typing/content";

export default class Builder extends MountBuilder {
    public constructor(definition: ContentScriptDefinition) {
        super(definition);
    }

    protected resolveRender(
        render?: ContentScriptRenderValue | ContentScriptRenderHandler
    ): ContentScriptRenderHandler | undefined {
        return render === undefined ? undefined : createRenderResolver(render);
    }

    protected async createNode(anchor: Element): Promise<ContentScriptNode> {
        let value = await this.getValue(anchor);

        if (value !== true && !isValidRenderValue(value)) {
            value = undefined;

            console.warn("Content script vanilla value is not a valid render value");
        }

        return new VanillaNode(await super.createNode(anchor), value);
    }
}
