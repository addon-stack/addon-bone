import type {AssetInfo, Chunk, Compilation, Filename, PathData} from "@rspack/core";

import {toPosix} from "@cli/utils/path";

export const CssContentHashType = "css/mini-extract";
export const JavaScriptContentHashType = "javascript";
const UnsupportedCallbackHashError =
    "Build assets filename callbacks cannot read PathData hash values; return [contenthash], [chunkhash], or [fullhash] placeholders instead";

type FilenameTemplateCache = Map<Filename, Map<Chunk, Map<string, string>>>;

const filenameTemplateCaches = new WeakMap<Compilation, FilenameTemplateCache>();

// Final hashes do not exist while chunkHash is calculated. Returning placeholders keeps the callback result
// hashable before Rspack resolves those placeholders into the emitted filename.
const rejectResolvedHashAccess = <T extends object>(value: T): T => {
    return new Proxy(value, {
        get(target, property, receiver) {
            if (property === "hash" || property === "contentHash") {
                throw new Error(UnsupportedCallbackHashError);
            }

            return Reflect.get(target, property, receiver);
        },
    });
};

const getFilenameCallbackContext = (
    compilation: Compilation,
    chunk: Chunk,
    contentHashType: string
): {assetInfo: AssetInfo; pathData: PathData} => {
    const id = chunk.id == null ? undefined : String(chunk.id);
    const pathData: PathData = {
        chunk: rejectResolvedHashAccess({
            id,
            name: chunk.name ?? id,
            hash: chunk.hash ?? undefined,
        }),
        contentHash: chunk.contentHash[contentHashType],
        hash: compilation.fullHash ?? undefined,
    };
    const assetInfo: AssetInfo = {
        fullhash: [],
        chunkhash: [],
        contenthash: [],
        related: {},
        assetType: contentHashType === JavaScriptContentHashType ? "javascript" : "extract-css",
    };

    if (contentHashType === JavaScriptContentHashType) {
        pathData.runtime = undefined;
        assetInfo.javascriptModule = Boolean(compilation.outputOptions.module);
    }

    return {assetInfo, pathData: rejectResolvedHashAccess(pathData)};
};

const getFilenamePathData = (compilation: Compilation, chunk: Chunk, contentHashType: string): PathData => {
    return {
        chunk,
        contentHash: chunk.contentHash[contentHashType],
        contentHashType,
        hash: compilation.fullHash ?? undefined,
    };
};

export const resolveFilenameTemplate = (
    compilation: Compilation,
    chunk: Chunk,
    filename: Filename,
    contentHashType: string
): string => {
    if (typeof filename !== "function") {
        return filename;
    }

    let compilationCache = filenameTemplateCaches.get(compilation);

    if (!compilationCache) {
        compilationCache = new Map();
        filenameTemplateCaches.set(compilation, compilationCache);
    }

    let filenameCache = compilationCache.get(filename);

    if (!filenameCache) {
        filenameCache = new Map();
        compilationCache.set(filename, filenameCache);
    }

    let chunkCache = filenameCache.get(chunk);

    if (!chunkCache) {
        chunkCache = new Map();
        filenameCache.set(chunk, chunkCache);
    }

    const cached = chunkCache.get(contentHashType);

    if (cached !== undefined) {
        return cached;
    }

    const {assetInfo, pathData} = getFilenameCallbackContext(compilation, chunk, contentHashType);
    const template = filename(pathData, assetInfo);

    chunkCache.set(contentHashType, template);

    return template;
};

export const resolveChunkFilename = (
    compilation: Compilation,
    chunk: Chunk,
    filename: Filename,
    contentHashType: string
): string => {
    const data = getFilenamePathData(compilation, chunk, contentHashType);
    const template = resolveFilenameTemplate(compilation, chunk, filename, contentHashType);

    return toPosix(compilation.getPath(template, data));
};

export const filenameRequiresFullHash = (
    compilation: Compilation,
    chunk: Chunk,
    filename: Filename,
    contentHashType: string
): boolean => {
    const template = resolveFilenameTemplate(compilation, chunk, filename, contentHashType);
    const callbackUsesHash = typeof filename === "function" && /\b(?:fullHash|hash)\b/.test(filename.toString());

    return callbackUsesHash || /\[(?:fullhash|hash)(?::\d+)?\]/i.test(template);
};
