import type {AssetInfo, Chunk, Compilation, Filename, Module} from "@rspack/core";
import _ from "lodash";
import path from "path";

import {toPosix} from "@cli/utils/path";

import type {EntrypointAssetsMap, EntrypointAssetsMapEntry} from "@typing/entrypoint";

type AssetKind = "asset" | "css" | "js";

const compilationBuildAssets = new WeakMap<Compilation, EntrypointAssetsMap>();

// prettier-ignore
export const appFilenameResolver =
    (app: string, filename: Filename, dirname?: string): Filename => {
        app = _.kebabCase(app);

        const resolve = (name: string): string => {
            name = name.replaceAll("[app]", app);

            return dirname ? path.posix.join(dirname, name) : name;
        };

        if (!_.isFunction(filename)) {
            return resolve(filename);
        }

        return (pathData, assetInfo): string => {
            return resolve(filename(pathData, assetInfo));
        };
    };

const addRelatedSourceMaps = (sourceMaps: Set<string>, related: AssetInfo["related"]): void => {
    const sourceMap = related?.sourceMap;

    if (Array.isArray(sourceMap)) {
        sourceMap.forEach(file => sourceMaps.add(toPosix(file)));
    } else if (sourceMap) {
        sourceMaps.add(toPosix(sourceMap));
    }
};

const getRelatedSourceMaps = (compilation: Compilation): ReadonlySet<string> => {
    const sourceMaps = new Set<string>();

    compilation.getAssets().forEach(({info}) => addRelatedSourceMaps(sourceMaps, info.related));

    return sourceMaps;
};

const isIgnoredAsset = (file: string, info: AssetInfo, sourceMaps: ReadonlySet<string>): boolean => {
    return Boolean(info.development || info.hotModuleReplacement || sourceMaps.has(file));
};

const classifyAsset = (file: string, info: AssetInfo, fromModuleAssets: boolean): AssetKind => {
    if (info.assetType === "javascript") {
        return "js";
    }

    if (info.assetType === "css" || info.assetType === "extract-css") {
        return "css";
    }

    if (info.assetType || info.sourceFilename || fromModuleAssets) {
        return "asset";
    }

    if (file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".cjs")) {
        return "js";
    }

    if (file.endsWith(".css")) {
        return "css";
    }

    return "asset";
};

const getAssetKind = (
    compilation: Compilation,
    file: string,
    sourceMaps: ReadonlySet<string>,
    fromModuleAssets = false
): AssetKind | undefined => {
    file = toPosix(file);

    const asset = compilation.getAsset(file);

    if (!asset || isIgnoredAsset(file, asset.info, sourceMaps)) {
        return;
    }

    return classifyAsset(file, asset.info, fromModuleAssets);
};

const getModuleAssetNames = (module: Module): readonly string[] => {
    return Object.keys(module.buildInfo?.assets ?? {});
};

const collectResources = (
    compilation: Compilation,
    chunks: Iterable<Chunk>,
    sourceMaps: ReadonlySet<string>
): readonly string[] => {
    const candidates = new Map<string, boolean>();

    for (const chunk of chunks) {
        for (const file of [...chunk.files, ...chunk.auxiliaryFiles]) {
            const normalized = toPosix(file);

            candidates.set(normalized, candidates.get(normalized) ?? false);
        }

        for (const module of compilation.chunkGraph.getChunkModulesIterable(chunk)) {
            for (const file of getModuleAssetNames(module)) {
                candidates.set(toPosix(file), true);
            }
        }
    }

    return Array.from(candidates)
        .filter(([file, fromModuleAssets]) => {
            return getAssetKind(compilation, file, sourceMaps, fromModuleAssets) === "asset";
        })
        .map(([file]) => file)
        .toSorted();
};

const collectCodeFiles = (
    compilation: Compilation,
    files: Iterable<string>,
    sourceMaps: ReadonlySet<string>
): {css: readonly string[]; js: readonly string[]} => {
    const css = new Set<string>();
    const js = new Set<string>();

    for (const rawFile of files) {
        const file = toPosix(rawFile);
        const kind = getAssetKind(compilation, file, sourceMaps);

        if (kind === "js") {
            js.add(file);
        } else if (kind === "css") {
            css.add(file);
        }
    }

    return {js: Array.from(js), css: Array.from(css)};
};

const collectAsyncCodeFiles = (
    compilation: Compilation,
    chunks: Iterable<Chunk>,
    sourceMaps: ReadonlySet<string>,
    initialFiles: ReadonlySet<string>
): {css: readonly string[]; js: readonly string[]} => {
    const files = new Set<string>();

    for (const chunk of chunks) {
        for (const file of [...chunk.files, ...chunk.auxiliaryFiles]) {
            const normalized = toPosix(file);

            if (!initialFiles.has(normalized)) {
                files.add(normalized);
            }
        }
    }

    return collectCodeFiles(compilation, files, sourceMaps);
};

export const collectBuildAssets = (compilation: Compilation): EntrypointAssetsMap => {
    const sourceMaps = getRelatedSourceMaps(compilation);
    const assets = Object.create(null) as Record<string, EntrypointAssetsMapEntry>;

    const entrypoints = Array.from(compilation.entrypoints).toSorted(([left], [right]) => left.localeCompare(right));

    for (const [name, entrypoint] of entrypoints) {
        const initial = collectCodeFiles(compilation, entrypoint.getFiles(), sourceMaps);
        const initialFiles = new Set([...initial.js, ...initial.css]);
        const entryChunk = entrypoint.getEntrypointChunk();

        assets[name] = {
            initial,
            async: collectAsyncCodeFiles(compilation, entryChunk.getAllAsyncChunks(), sourceMaps, initialFiles),
            assets: collectResources(compilation, entryChunk.getAllReferencedChunks(), sourceMaps),
        };
    }

    return assets;
};

export const setCompilationBuildAssets = (compilation: Compilation, assets: EntrypointAssetsMap): void => {
    compilationBuildAssets.set(compilation, assets);
};

export const getCompilationBuildAssets = (compilation: Compilation): EntrypointAssetsMap | undefined => {
    return compilationBuildAssets.get(compilation);
};
