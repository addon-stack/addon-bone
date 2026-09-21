import {
    TransportDefinition,
    TransportInitGetter,
    TransportMainHandler,
    TransportOptions,
    TransportType,
    TransportUnresolvedDefinition,
} from "@typing/transport";
import {RelayDefinition, RelayMainHandler} from "@typing/relay";
import {OffscreenDefinition, OffscreenMainHandler} from "@typing/offscreen";

export const isValidTransportDefinition = <O extends TransportOptions, T extends TransportType>(
    definition: any
): definition is TransportDefinition<O, T> & RelayDefinition<T> & OffscreenDefinition<T> => {
    return definition && typeof definition === "object" && definition.constructor === Object;
};

export const isValidTransportInitFunction = <O extends TransportOptions, T extends TransportType>(
    init: any
): init is TransportInitGetter<O, T> => {
    return init && typeof init === "function";
};

export const isValidTransportMainFunction = <O extends TransportOptions, T extends TransportType>(
    main: any
): main is TransportMainHandler<O, T> & RelayMainHandler<T> & OffscreenMainHandler<T> => {
    return main && typeof main === "function";
};

export const isValidTransportName = (name: any): name is string => {
    return name && typeof name === "string" && name.trim().length > 0;
};

/**
 * Merge transport exports without executing init: default options override named exports,
 * and a default function is the init. The build supplies the authoritative name.
 */
export const mergeDefinition = (
    module: object,
    name: string
): TransportUnresolvedDefinition<TransportOptions, TransportType> => {
    const {default: defaultDefinition, ...namedDefinition} = module as Record<string, unknown>;

    let definition = namedDefinition as TransportUnresolvedDefinition<TransportOptions, TransportType>;

    if (isValidTransportDefinition(defaultDefinition)) {
        definition = {...definition, ...defaultDefinition};
    } else if (isValidTransportInitFunction(defaultDefinition)) {
        definition = {...definition, init: defaultDefinition};
    }

    const {init, main, name: _, ...options} = definition;

    return {name, init, main, ...options};
};
