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

export {
    default as IsolatedStylesPlugin,
    type IsolatedStylesPluginOptions,
    type IsolatedStylesPluginFiles,
} from "./isolated-styles";

export {
    default as BuildAssetsMapPlugin,
    type BuildAssetsMapPluginOptions,
    type BuildAssetsMapPluginModuleOptions,
} from "./build-assets-map";

export {
    default as GenerateJsonPlugin,
    type GenerateJsonPluginData,
    type GenerateJsonPluginUpdate,
} from "./generate-json";

export {
    GenerateModulePlugin,
    type GenerateModulePluginDependencies,
    type GenerateModulePluginDependenciesResolver,
    type GenerateModulePluginModules,
    type GenerateModulePluginUpdate,
} from "./generate-module";

export {default as ManifestPlugin} from "./manifest";

export {
    default as ResourceAccessPlugin,
    type ResourceAccessPluginOptions,
    type ResourceAccessPluginRequirement,
} from "./resource-access";

export {default as ReplacePlugin} from "./replace";

export {default as WatchPlugin} from "./watch";

export type {RuntimePropertyOptions, RuntimeModuleReaderOptions} from "./types";
