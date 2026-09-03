import type {EntrypointAssets, EntrypointAssetsMap} from "@typing/entrypoint";

interface BuildAssetsRuntime {
    (moduleId: string | number): unknown;
    __adnbnBuildAssets?: EntrypointAssetsMap;
    __adnbnCurrentEntrypointAssets?: EntrypointAssets;
}

declare const __webpack_require__: BuildAssetsRuntime;

export type {
    EntrypointAssets,
    EntrypointAssetsFiles,
    EntrypointAssetsMap,
    EntrypointAssetsMapEntry,
} from "@typing/entrypoint";

export const getEntrypointAssetsMap = (): EntrypointAssetsMap => {
    const assets = typeof __webpack_require__ === "function" ? __webpack_require__.__adnbnBuildAssets : undefined;

    if (!assets) {
        throw new Error("getEntrypointAssetsMap() is available only in the background entrypoint");
    }

    return assets;
};

export const getEntrypointAssets = (): EntrypointAssets => {
    const assets =
        typeof __webpack_require__ === "function" ? __webpack_require__.__adnbnCurrentEntrypointAssets : undefined;

    if (!assets) {
        throw new Error("Current entrypoint assets are unavailable in this runtime");
    }

    return assets;
};
