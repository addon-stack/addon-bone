import {RuntimeGlobals} from "@rspack/core";

import {EntrypointAssetsMapRuntimeProperty, EntrypointAssetsRuntimeProperty} from "@typing/entrypoint";

import type {BuildAssetsMapPluginModuleOptions} from "./usage";

export const EntrypointAssetsModule = {
    request: "#adnbn/entrypoint",
    current: {export: "readAssets", property: EntrypointAssetsRuntimeProperty},
    full: {export: "readAssetsMap", property: EntrypointAssetsMapRuntimeProperty},
} satisfies BuildAssetsMapPluginModuleOptions;

/** Readers keep runtime data live without capturing a snapshot during module evaluation. */
export const createEntrypointModule = (): string =>
    [EntrypointAssetsModule.current, EntrypointAssetsModule.full]
        .map(
            ({export: name, property}) =>
                `export const ${name} = () => ${RuntimeGlobals.require}[${JSON.stringify(property)}];\n`
        )
        .join("");
