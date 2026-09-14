import {createElement, isValidElement} from "react";

import {ContentScriptRenderHandler, ContentScriptRenderValue} from "@typing/content";

export const createRenderResolver =
    (render?: ContentScriptRenderValue): ContentScriptRenderHandler =>
    async (props): Promise<undefined | ContentScriptRenderValue> => {
        let resolvedRender = typeof render === "function" ? createElement(render, props) : render;

        if (isValidElement(resolvedRender)) {
            return resolvedRender;
        }
    };
