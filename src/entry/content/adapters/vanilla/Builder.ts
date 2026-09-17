import MountBuilder from "../../lifecycle/MountBuilder";
import VanillaNode from "./Node";
import {isValidRenderValue} from "./utils";
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

        return props => {
            const resolvedRender = typeof render === "function" ? render(props) : render;

            if (!isValidRenderValue(resolvedRender)) {
                return;
            }

            return resolvedRender;
        };
    }

    protected createRenderer(
        node: ContentScriptNode,
        render: ContentScriptRenderHandler<Data>,
        props: () => ContentScriptProps<Data>,
        options: ContentScriptRenderOptions
    ): VanillaNode<Data> {
        return new VanillaNode(node, render, props, options);
    }
}
