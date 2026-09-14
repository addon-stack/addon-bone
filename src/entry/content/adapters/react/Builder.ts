import {isValidElement} from "react";

import MountBuilder from "../../lifecycle/MountBuilder";
import ReactNode from "./Node";

import {createRenderResolver} from "./resolvers/render";

import {
    ContentScriptDefinition,
    ContentScriptNode,
    ContentScriptRenderHandler,
    ContentScriptRenderValue,
} from "@typing/content";

export default class Builder extends MountBuilder {
    constructor(definition: ContentScriptDefinition) {
        super(definition);
    }

    protected resolveRender(render?: ContentScriptRenderValue): ContentScriptRenderHandler | undefined {
        if (render === undefined) {
            return;
        }

        return createRenderResolver(render);
    }

    protected async createNode(anchor: Element): Promise<ContentScriptNode> {
        let value = await this.getValue(anchor);

        if (!isValidElement(value)) {
            value = undefined;

            console.warn("Content script react value is not a valid React element");
        }

        return new ReactNode(await super.createNode(anchor), value);
    }
}
