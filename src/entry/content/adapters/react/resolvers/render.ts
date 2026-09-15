import {createElement, isValidElement} from "react";

import type {
    ContentScriptRenderHandler,
    ContentScriptRenderValue,
    ContentScriptRenderReactComponent,
} from "@typing/content";

export const createRenderResolver =
    <Data = unknown>(
        render?: ContentScriptRenderValue<Data> | ContentScriptRenderHandler<Data>
    ): ContentScriptRenderHandler<Data> =>
    props => {
        // Functions in React entrypoints are components; React owns their invocation and hooks.
        const value =
            typeof render === "function"
                ? createElement(render as ContentScriptRenderReactComponent<Data>, props)
                : render;

        return isValidElement(value) ? value : undefined;
    };
