import {BackgroundDefinition, BackgroundMainHandler} from "@typing/background";

const isDefinitionObject = (value: unknown): value is BackgroundDefinition => {
    return value !== null && typeof value === "object" && value.constructor === Object;
};

export const isValidBackgroundMainHandler = (main: unknown): main is BackgroundMainHandler => {
    return typeof main === "function";
};

/**
 * Merge background exports without executing main: default options override named exports,
 * and a default function is the main handler. Any other default value is ignored.
 */
export const resolveDefinition = (module: object): BackgroundDefinition => {
    const {default: defaultDefinition, ...namedDefinition} = module as Record<string, unknown>;
    const definition = namedDefinition as BackgroundDefinition;

    if (isDefinitionObject(defaultDefinition)) {
        return {...definition, ...defaultDefinition};
    }

    if (isValidBackgroundMainHandler(defaultDefinition)) {
        return {...definition, main: defaultDefinition};
    }

    return definition;
};
