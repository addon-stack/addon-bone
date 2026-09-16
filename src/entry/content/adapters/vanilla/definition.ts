import {mergeDefinition} from "../../resolvers/definition";
import {isValidRenderValue} from "./utils";

import type {ContentScriptDefinition} from "@typing/content";

export const resolveDefinition = (module: object): ContentScriptDefinition => {
    return mergeDefinition(module, value => typeof value === "function" || isValidRenderValue(value));
};
