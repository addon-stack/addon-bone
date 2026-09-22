import {mergeDefinition} from "@entry/transport/resolvers/definition";

import type {OffscreenUnresolvedDefinition} from "@typing/offscreen";
import type {TransportType} from "@typing/transport";

/** A default function is the offscreen transport init; the view renders only an explicit render. */
export const resolveDefinition = <T extends TransportType = TransportType>(
    module: object,
    name: string
): OffscreenUnresolvedDefinition<T> => {
    return mergeDefinition(module, name) as OffscreenUnresolvedDefinition<T>;
};
