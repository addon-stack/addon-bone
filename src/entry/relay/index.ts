import Builder from "./Builder";

import type {RelayUnresolvedDefinition} from "@typing/relay";
import type {TransportType} from "@typing/transport";
import type {ContentScriptIsolation} from "@typing/content";

export {Builder};
export {resolveDefinition} from "./resolvers/definition";

export type {RelayUnresolvedDefinition} from "@typing/relay";

export default function relay<
    T extends TransportType,
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
>(
    definition: RelayUnresolvedDefinition<T, Data, Isolation>,
    contentBuilder: ConstructorParameters<typeof Builder<T, Data, NoInfer<Isolation>>>[1]
): void {
    new Builder(definition, contentBuilder).build().catch(error => {
        console.error("Failed to build relay: ", error);
    });
}
