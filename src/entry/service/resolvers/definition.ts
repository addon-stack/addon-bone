import {mergeDefinition} from "@entry/transport/resolvers/definition";

import type {ServiceUnresolvedDefinition} from "@typing/service";
import type {TransportType} from "@typing/transport";

export const resolveDefinition = <T extends TransportType = TransportType>(
    module: object,
    name: string
): ServiceUnresolvedDefinition<T> => {
    return mergeDefinition(module, name) as ServiceUnresolvedDefinition<T>;
};
