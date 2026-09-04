export {
    default as EntrypointPlugin,
    type EntrypointPluginEntryOptions,
    type EntrypointPluginEntryOptionsResolver,
    type EntrypointPluginModules,
    type EntrypointPluginModule,
    type EntrypointPluginEntryModules,
    type EntrypointPluginTemplate,
    type EntrypointPluginUpdate,
} from "./entrypoint";

export {default as ChunkLoaderPlugin, type ChunkLoaderPluginOptions} from "./chunk-loader";

export {default as ShadowStylesPlugin, type ShadowStylesPluginOptions} from "./shadow-styles";

export {default as BuildAssetsMapPlugin, type BuildAssetsMapPluginOptions} from "./build-assets-map";

export {
    default as GenerateJsonPlugin,
    type GenerateJsonPluginData,
    type GenerateJsonPluginUpdate,
} from "./generate-json";

export {default as ManifestPlugin} from "./manifest";

export {default as ReplacePlugin} from "./replace";

export {default as WatchPlugin} from "./watch";
