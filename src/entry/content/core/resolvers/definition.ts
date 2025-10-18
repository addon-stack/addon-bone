import {isValidContentScriptRenderValue} from "./render";

import {ContentScriptDefinition, ContentScriptRenderHandler, ContentScriptRenderValue} from "@typing/content";

export const isContentScriptDefinition = (definition: any): definition is ContentScriptDefinition => {
    return (
        definition && typeof definition === "object" && definition.constructor === Object && !("$$typeof" in definition)
    );
};

export const isValidContentScriptDefinitionRenderValue = (
    definition: any
): definition is ContentScriptRenderValue | ContentScriptRenderHandler => {
    return (
        isValidContentScriptRenderValue(definition) ||
        typeof definition === "function" ||
        (typeof definition === "object" && definition.constructor === Object && "$$typeof" in definition)
    );
};
