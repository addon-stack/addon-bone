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

export {default as ChunkLoaderPlugin, type ChunkLoaderPluginOptions} from "./ChunkLoaderPlugin";

export {default as BuildAssetsMapPlugin} from "./BuildAssetsMapPlugin";

export {
    default as GenerateJsonPlugin,
    type GenerateJsonPluginData,
    type GenerateJsonPluginUpdate,
} from "./GenerateJsonPlugin";

export {default as ManifestPlugin} from "./ManifestPlugin";

export {default as ReplacePlugin} from "./ReplacePlugin";

export {default as WatchPlugin} from "./WatchPlugin";
