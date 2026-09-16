import {createElement, isValidElement} from "react";

import ReactNode from "./Node";

import MountBuilder from "../../lifecycle/MountBuilder";
import type {ContentScriptRenderOptions} from "../../lifecycle/types";

import type {
    ContentScriptNode,
    ContentScriptIsolation,
    ContentScriptProps,
    ContentScriptRenderHandler,
    ContentScriptRenderReactComponent,
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
            // Functions in React entrypoints are components; React owns their invocation and hooks.
            const value =
                typeof render === "function"
                    ? createElement(render as ContentScriptRenderReactComponent<Data>, props)
                    : render;

            return isValidElement(value) ? value : undefined;
        };
    }

    protected createRenderer(
        node: ContentScriptNode,
        render: ContentScriptRenderHandler<Data>,
        props: () => ContentScriptProps<Data>,
        options: ContentScriptRenderOptions
    ): ReactNode<Data> {
        return new ReactNode(node, render, props, options);
    }
}
