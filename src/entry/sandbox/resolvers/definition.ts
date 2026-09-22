import {mergeDefinition} from "@entry/transport/resolvers/definition";

import type {SandboxUnresolvedDefinition} from "@typing/sandbox";
import type {TransportType} from "@typing/transport";

/** A default function is the sandbox transport init; the view renders only an explicit render. */
export const resolveDefinition = <T extends TransportType = TransportType>(
    module: object,
    name: string
): SandboxUnresolvedDefinition<T> => {
    return mergeDefinition(module, name) as SandboxUnresolvedDefinition<T>;
};
