import {isDomRenderValue} from "@entry/core/render";
import {isReactRenderValue} from "@entry/core/react";

import {mergeDefinition} from "../../resolvers/definition";

import type {ViewConfig, ViewDefinition} from "@typing/view";

export const resolveDefinition = (module: object): ViewDefinition<ViewConfig> => {
    return mergeDefinition(
        module,
        value => typeof value === "function" || isDomRenderValue(value) || isReactRenderValue(value)
    );
};
