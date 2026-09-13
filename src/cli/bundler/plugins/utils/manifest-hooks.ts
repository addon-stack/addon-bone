import type {Compilation} from "@rspack/core";
import {AsyncSeriesHook} from "@rspack/lite-tapable";
import type {ReadonlyDeep} from "type-fest";

import type {EntrypointAssetsMap} from "@typing/entrypoint";
import type {Manifest, ManifestDependencies} from "@typing/manifest";

export interface ManifestHooks {
    /** Prepare manifest-only file lists after output names are final; do not alter the runtime assets map. */
    prepareDependencies: AsyncSeriesHook<[ManifestDependencies, ReadonlyDeep<EntrypointAssetsMap>]>;
    /** Validate the final merged manifest before serialization. This hook must not modify it. */
    validate: AsyncSeriesHook<[ReadonlyDeep<Manifest>]>;
}

const compilationHooks = new WeakMap<Compilation, ManifestHooks>();

/** Share hooks within one compilation without retaining subscriptions across watch rebuilds. */
export const getManifestHooks = (compilation: Compilation): ManifestHooks => {
    let hooks = compilationHooks.get(compilation);

    if (!hooks) {
        hooks = {
            prepareDependencies: new AsyncSeriesHook(["dependencies", "buildAssets"]),
            validate: new AsyncSeriesHook(["manifest"]),
        };
        compilationHooks.set(compilation, hooks);
    }

    return hooks;
};
