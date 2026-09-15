import {readAssets, readAssetsMap} from "#adnbn/runtime";

import type {EntrypointAssets, EntrypointAssetsMap} from "@typing/entrypoint";

export type {
    EntrypointAssets,
    EntrypointAssetsFiles,
    EntrypointAssetsMap,
    EntrypointAssetsMapEntry,
} from "@typing/entrypoint";

export const getEntrypointAssetsMap = (): EntrypointAssetsMap => {
    const assets = readAssetsMap();

    if (!assets) {
        throw new Error("getEntrypointAssetsMap() is available only in the background entrypoint");
    }

    return assets;
};

export const getEntrypointAssets = (): EntrypointAssets => {
    const assets = readAssets();

    if (!assets) {
        throw new Error("Current entrypoint assets are unavailable in this runtime");
    }

    return assets;
};
