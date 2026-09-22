import {ViewConfig, ViewDefinition} from "@typing/view";

/** Adapters must recognize their render values before falling back to an options object. */
const isDefinitionObject = (value: unknown): value is ViewDefinition<ViewConfig> => {
    return value !== null && typeof value === "object" && value.constructor === Object;
};

/** Merge module exports using the selected adapter's interpretation of the default value. */
export const mergeDefinition = (
    module: object,
    isRenderInput: (value: unknown) => boolean
): ViewDefinition<ViewConfig> => {
    const {default: defaultDefinition, ...namedDefinition} = module as Record<string, unknown>;
    const definition = namedDefinition as ViewDefinition<ViewConfig>;

    if (isRenderInput(defaultDefinition)) {
        return {...definition, render: defaultDefinition} as ViewDefinition<ViewConfig>;
    }

    if (isDefinitionObject(defaultDefinition)) {
        return {...definition, ...defaultDefinition};
    }

    return definition;
};
