import ViewPermissionsFinder from "./ViewPermissionsFinder";
import PluginFinder from "./PluginFinder";

import {ReadonlyConfig} from "@typing/config";
import {EntrypointOptionsFinder} from "@typing/entrypoint";
import {OverrideEntrypointOptions, OverrideEntrypointType} from "@typing/override";

/**
 * Override pages are singletons: app files replace shared ones instead of merging with them,
 * and only the highest-precedence candidate becomes a view.
 */
export default abstract class AbstractOverrideFinder<
    O extends OverrideEntrypointOptions,
> extends ViewPermissionsFinder<O> {
    protected constructor(config: ReadonlyConfig) {
        super(config);
    }

    public abstract type(): OverrideEntrypointType;

    protected getPlugin(): EntrypointOptionsFinder<O> {
        // Plugin handlers of override pages are keyed by their entrypoint type.
        return new PluginFinder(this.config, `${this.type()}` as const, this);
    }

    public canMerge(): boolean {
        return false;
    }

    public allowMultiple(): boolean {
        return false;
    }
}
