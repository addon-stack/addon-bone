import type {Chunk, Compilation, Module} from "@rspack/core";

// This is a bundler layer, not a CSS @layer. A distinct css-loader identity is
// also required: CssExtract deduplicates dependencies by their loader request.
export const IsolatedStylesLayer = "adnbn:css:isolation";

export const isIsolatedStylesModule = (module: Module): boolean =>
    module.type === "css/mini-extract" && module.layer === IsolatedStylesLayer;

export const isIsolatedStylesChunk = (compilation: Compilation, chunk: Chunk): boolean => {
    const modules = [...compilation.chunkGraph.getChunkModulesIterable(chunk)].filter(
        module => module.type === "css/mini-extract"
    );
    const isolated = modules.some(isIsolatedStylesModule);
    if (isolated && !modules.every(isIsolatedStylesModule)) {
        throw new Error(
            `CSS chunk "${chunk.name ?? chunk.id}" mixes document and ?isolation styles. Preserve the adnbnIsolatedStyles CSS cache group in your bundler configuration.`
        );
    }
    return isolated;
};

export const getIsolatedStylesFiles = (compilation: Compilation): ReadonlySet<string> => {
    const files = new Set<string>();
    for (const chunk of compilation.chunks) {
        if (isIsolatedStylesChunk(compilation, chunk)) {
            for (const file of chunk.files) if (file.endsWith(".css")) files.add(file);
        }
    }
    return files;
};
