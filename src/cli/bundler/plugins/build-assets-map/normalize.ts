import type {EntrypointAssets, EntrypointAssetsMap} from "@typing/entrypoint";

// realContentHash may merge different chunk filenames into one emitted file.
export const normalizeAssets = <T extends EntrypointAssets>(assets: T): T => {
    const initial = {
        js: [...new Set(assets.initial.js)],
        css: [...new Set(assets.initial.css)],
    };

    const initialFiles = new Set([...initial.js, ...initial.css]);

    const async = {
        js: [...new Set(assets.async.js)].filter(file => !initialFiles.has(file)),
        css: [...new Set(assets.async.css)].filter(file => !initialFiles.has(file)),
    };

    return {
        ...assets,
        initial,
        async,
    };
};

export const normalizeAssetsMap = (assets: EntrypointAssetsMap): EntrypointAssetsMap => {
    return Object.fromEntries(Object.entries(assets).map(([name, entry]) => [name, normalizeAssets(entry)]));
};
