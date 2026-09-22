import Builder from "./Builder";

import type {OffscreenEntrypointOptions, OffscreenUnresolvedDefinition} from "@typing/offscreen";
import type {TransportType} from "@typing/transport";
import type {ViewBuilderConstructor} from "@typing/view";

export {Builder};
export {resolveDefinition} from "./resolvers/definition";

export default function offscreen<T extends TransportType>(
    definition: OffscreenUnresolvedDefinition<T>,
    viewBuilder: ViewBuilderConstructor<OffscreenEntrypointOptions>
): void {
    new Builder(definition, viewBuilder).build().catch(error => {
        console.error("Failed to build offscreen: ", error);
    });
}
