import {mergeDefinition} from "@entry/transport/resolvers/definition";

import type {RelayUnresolvedDefinition} from "@typing/relay";
import type {TransportType} from "@typing/transport";

/** A default function is Relay's transport init, never a content render. */
export const resolveDefinition = <T extends TransportType = TransportType>(
    module: object,
    name: string
): RelayUnresolvedDefinition<T> => {
    return mergeDefinition(module, name) as RelayUnresolvedDefinition<T>;
};
