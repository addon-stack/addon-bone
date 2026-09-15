import type {BuildAssetsMapPluginModuleOptions, RuntimeModuleReaderOptions} from "@cli/bundler/plugins";

import {ContentScriptStylesRuntimeProperty} from "@typing/content";
import {EntrypointAssetsMapRuntimeProperty, EntrypointAssetsRuntimeProperty} from "@typing/entrypoint";

export const RuntimeModuleRequest = "#adnbn/runtime";

export const RuntimeModuleReaders = {
    assets: {export: "readAssets", property: EntrypointAssetsRuntimeProperty},
    assetsMap: {export: "readAssetsMap", property: EntrypointAssetsMapRuntimeProperty},
    contentStyles: {export: "readContentStyles", property: ContentScriptStylesRuntimeProperty},
} as const satisfies Record<string, RuntimeModuleReaderOptions>;

export const EntrypointAssetsModule = {
    request: RuntimeModuleRequest,
    current: RuntimeModuleReaders.assets,
    full: RuntimeModuleReaders.assetsMap,
} satisfies BuildAssetsMapPluginModuleOptions;
