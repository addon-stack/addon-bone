export {
    default as EntrypointPlugin,
    type EntrypointPluginEntryOptions,
    type EntrypointPluginEntryOptionsResolver,
    type EntrypointPluginModules,
    type EntrypointPluginModule,
    type EntrypointPluginEntryModules,
    type EntrypointPluginTemplate,
    type EntrypointPluginUpdate,
} from "./EntrypointPlugin";

export {default as ChunkLoaderPlugin, type ChunkLoaderPluginOptions} from "./chunk-loader";

export {default as ShadowStylesPlugin, type ShadowStylesPluginOptions} from "./shadow-styles";

export {default as BuildAssetsMapPlugin, type BuildAssetsMapPluginOptions} from "./build-assets-map";

export {
    default as GenerateJsonPlugin,
    type GenerateJsonPluginData,
    type GenerateJsonPluginUpdate,
} from "./GenerateJsonPlugin";

export {default as ManifestPlugin} from "./ManifestPlugin";

export {default as ReplacePlugin} from "./ReplacePlugin";

export {default as WatchPlugin} from "./WatchPlugin";
