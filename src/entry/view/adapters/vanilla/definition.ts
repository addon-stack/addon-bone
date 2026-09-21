import {mergeDefinition} from "../../resolvers/definition";
import {isValidRenderValue} from "./utils";

import type {ViewConfig, ViewDefinition} from "@typing/view";

export const resolveDefinition = (module: object): ViewDefinition<ViewConfig> => {
    return mergeDefinition(module, value => typeof value === "function" || isValidRenderValue(value));
};
