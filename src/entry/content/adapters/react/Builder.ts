import MountBuilder from "../../lifecycle/MountBuilder";
import RenderNode from "./Node";
import {createRenderResolver} from "./resolvers/render";

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
    ): ContentScriptRenderHandler<Data> | undefined {
        return render === undefined ? undefined : createRenderResolver(render);
    }

    protected createRenderer(
        node: ContentScriptNode,
        render: ContentScriptRenderHandler<Data>,
        props: () => ContentScriptProps<Data>
    ): ContentScriptNode {
        return new RenderNode(node, render, props);
    }
}
