import {isValidTransportDefinition, isValidTransportInitFunction} from "@entry/transport/resolvers/definition";

import type {RelayOptions, RelayUnresolvedDefinition} from "@typing/relay";
import type {TransportType} from "@typing/transport";

/** Resolve Relay exports without executing init; the build supplies the authoritative name. */
export const resolveDefinition = <T extends TransportType = TransportType>(
    module: object,
    name: string
): RelayUnresolvedDefinition<T> => {
    const {default: defaultDefinition, ...otherDefinition} = module as Record<string, unknown>;

    let definition = otherDefinition as RelayUnresolvedDefinition<T>;

    if (isValidTransportDefinition<RelayOptions, T>(defaultDefinition)) {
        definition = {...definition, ...defaultDefinition};
    } else if (isValidTransportInitFunction<RelayOptions, T>(defaultDefinition)) {
        definition = {...definition, init: defaultDefinition};
    }

    const {init, main, name: _name, ...options} = definition;

    return {name, init, main, ...options};
};
