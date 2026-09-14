import Builder from "./Builder";

import type {RelayUnresolvedDefinition} from "@typing/relay";
import type {TransportType} from "@typing/transport";

export {Builder};
export {resolveDefinition} from "./resolvers/definition";
export type {RelayUnresolvedDefinition} from "@typing/relay";

export default function relay<T extends TransportType, Data = unknown>(
    definition: RelayUnresolvedDefinition<T, Data>,
    contentBuilder: ConstructorParameters<typeof Builder<T, Data>>[1]
): void {
    new Builder(definition, contentBuilder).build().catch(error => {
        console.error("Failed to build relay: ", error);
    });
}
