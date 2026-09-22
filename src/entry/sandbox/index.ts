import Builder from "./Builder";

import type {SandboxEntrypointOptions, SandboxUnresolvedDefinition} from "@typing/sandbox";
import type {TransportType} from "@typing/transport";
import type {ViewBuilderConstructor} from "@typing/view";

export {Builder};
export {resolveDefinition} from "./resolvers/definition";

export default function sandbox<T extends TransportType>(
    definition: SandboxUnresolvedDefinition<T>,
    viewBuilder: ViewBuilderConstructor<SandboxEntrypointOptions>
): void {
    new Builder(definition, viewBuilder).build().catch(error => {
        console.error("Failed to build sandbox: ", error);
    });
}
