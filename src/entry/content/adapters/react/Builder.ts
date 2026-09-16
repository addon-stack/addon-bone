import MountBuilder from "../../lifecycle/MountBuilder";
import RenderNode from "./Node";
import {createRenderResolver} from "./resolvers/render";
import type {ContentScriptRenderOptions} from "../../lifecycle/types";

import type {
    ContentScriptNode,
    ContentScriptIsolation,
    ContentScriptProps,
    ContentScriptRenderHandler,
    ContentScriptRenderValue,
} from "@typing/content";

export default class Builder<
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
> extends MountBuilder<Data, Isolation> {
    protected resolveRender(
        render?: ContentScriptRenderValue<Data> | ContentScriptRenderHandler<Data>
    ): true | ContentScriptRenderHandler<Data> | undefined {
        if (render === true || render === undefined) {
            return render;
        }

        return createRenderResolver(render);
    }

    protected createRenderer(
        node: ContentScriptNode,
        render: ContentScriptRenderHandler<Data>,
        props: () => ContentScriptProps<Data>,
        options: ContentScriptRenderOptions
    ): RenderNode<Data> {
        return new RenderNode(node, render, props, options);
    }
}
