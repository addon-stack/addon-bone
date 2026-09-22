import {isDomRenderValue} from "@entry/core/render";
import {isReactRenderValue} from "@entry/core/react";

import {mergeDefinition} from "../../resolvers/definition";

import type {ContentScriptDefinition} from "@typing/content";

export const resolveDefinition = (module: object): ContentScriptDefinition => {
    return mergeDefinition(
        module,
        value => typeof value === "function" || isDomRenderValue(value) || isReactRenderValue(value)
    );
};
