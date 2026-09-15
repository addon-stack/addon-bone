import type {ContentScriptDefinition} from "@typing/content";

/** Adapters must recognize their render objects before falling back to an options object. */
const isDefinitionObject = (value: unknown): value is ContentScriptDefinition => {
    return value !== null && typeof value === "object" && value.constructor === Object;
};

/** Merge module exports using the selected adapter's interpretation of the default value. */
export const mergeDefinition = (
    module: object,
    isRenderInput: (value: unknown) => boolean
): ContentScriptDefinition => {
    const {default: defaultDefinition, ...definition} = module as Record<string, unknown>;

    if (isRenderInput(defaultDefinition)) {
        return {...definition, render: defaultDefinition} as ContentScriptDefinition;
    }

    if (isDefinitionObject(defaultDefinition)) {
        return {...definition, ...defaultDefinition};
    }

    return definition;
};

/** Resolve exports without a renderer; the content parser validates default render exports before navigation. */
export const resolveDefinition = (module: object): ContentScriptDefinition => {
    return mergeDefinition(
        module,
        value => value != null && value !== "" && typeof value !== "boolean" && !isDefinitionObject(value)
    );
};
