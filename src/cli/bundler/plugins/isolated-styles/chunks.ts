import type {Chunk, Compilation, Module} from "@rspack/core";

import {DocumentStylesLayer} from "@cli/bundler/layers";
import {DocumentStylesCacheGroup} from "./split-chunks";

const isDocumentStylesModule = (module: Module): boolean => module.layer === DocumentStylesLayer;

/** Only call for chunks reachable by an entry with isolated delivery. Other entries may mix CSS categories. */
export const isIsolatedStylesChunk = (compilation: Compilation, chunk: Chunk): boolean => {
    const modules = [...compilation.chunkGraph.getChunkModulesIterable(chunk)].filter(
        module => module.type === "css/mini-extract"
    );

    const document = modules.some(isDocumentStylesModule);

    if (document && !modules.every(isDocumentStylesModule)) {
        throw new Error(
            `CSS chunk "${chunk.name ?? chunk.id}" mixes document and default styles for isolated delivery. Preserve the ${DocumentStylesCacheGroup} CSS cache group in your bundler configuration.`
        );
    }

    return modules.length > 0 && !document;
};

export const getStylesFiles = (
    compilation: Compilation,
    chunks: Iterable<Chunk>
): {document: ReadonlySet<string>; defaults: ReadonlySet<string>} => {
    const document = new Set<string>();
    const defaults = new Set<string>();

    for (const chunk of chunks) {
        const files = isIsolatedStylesChunk(compilation, chunk) ? defaults : document;

        for (const file of chunk.files) {
            if (file.endsWith(".css")) {
                files.add(file);
            }
        }
    }

    return {document, defaults};
};
