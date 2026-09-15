import type {Compilation} from "@rspack/core";

import type {EntrypointAssetsMap} from "@typing/entrypoint";

const compilationBuildAssets = new WeakMap<Compilation, EntrypointAssetsMap>();

export const setCompilationBuildAssets = (compilation: Compilation, assets: EntrypointAssetsMap): void => {
    compilationBuildAssets.set(compilation, assets);
};

export const getCompilationBuildAssets = (compilation: Compilation): EntrypointAssetsMap | undefined => {
    return compilationBuildAssets.get(compilation);
};
