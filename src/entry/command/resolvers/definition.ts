import {CommandDefinition, CommandExecute, CommandUnresolvedDefinition} from "@typing/command";

const isDefinitionObject = (value: unknown): value is CommandDefinition => {
    return value !== null && typeof value === "object" && value.constructor === Object;
};

export const isValidCommandExecuteFunction = (execute: any): execute is CommandExecute => {
    return execute && typeof execute === "function";
};

export const isValidCommandName = (name: any): name is string => {
    return name && typeof name === "string" && name.trim().length > 0;
};

/**
 * Merge command exports without executing them: default options override named exports,
 * and a default function is the execute handler. The build supplies the authoritative name.
 */
export const resolveDefinition = (module: object, name: string): CommandUnresolvedDefinition => {
    const {default: defaultDefinition, ...namedDefinition} = module as Record<string, unknown>;

    let definition = namedDefinition as CommandUnresolvedDefinition;

    if (isDefinitionObject(defaultDefinition)) {
        definition = {...definition, ...defaultDefinition};
    } else if (isValidCommandExecuteFunction(defaultDefinition)) {
        definition = {...definition, execute: defaultDefinition};
    }

    return {...definition, name};
};
