import Builder from "./Builder";

import type {RelayDefinition, RelayUnresolvedDefinition} from "@typing/relay";
import type {TransportType} from "@typing/transport";
import type {ContentScriptBuilderConstructor, ContentScriptIsolation} from "@typing/content";

export {Builder};
export {resolveDefinition} from "./resolvers/definition";

export type {RelayUnresolvedDefinition} from "@typing/relay";

// Match Builder's full-definition overload before the partial bootstrap input.
export default function relay<
    T extends TransportType,
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
>(
    definition: RelayDefinition<T, Data, Isolation>,
    contentBuilder: ContentScriptBuilderConstructor<Data, Isolation>
): void;

export default function relay<
    T extends TransportType,
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
>(
    definition: RelayUnresolvedDefinition<T, Data, Isolation>,
    contentBuilder: ContentScriptBuilderConstructor<Data, Isolation>
): void;

export default function relay<
    T extends TransportType,
    Data = unknown,
    Isolation extends `${ContentScriptIsolation}` = `${ContentScriptIsolation}`,
>(
    definition: RelayUnresolvedDefinition<T, Data, Isolation>,
    contentBuilder: ContentScriptBuilderConstructor<Data, Isolation>
): void {
    new Builder(definition, contentBuilder).build().catch(error => {
        console.error("Failed to build relay: ", error);
    });
}
