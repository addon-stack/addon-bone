import type {Chunk, ChunkGroup, Compilation, Compiler, OptimizationSplitChunksCacheGroup} from "@rspack/core";

import {DocumentStylesLayer} from "@cli/bundler/layers";

export const DocumentStylesCacheGroup = "adnbnDocumentStyles";

/** Partition CSS only where an entry needs separate document and isolated delivery. */
export const createStylesCacheGroup = (
    compiler: Compiler,
    test: (entry: string) => boolean
): OptimizationSplitChunksCacheGroup => {
    let compilation: Compilation;
    let selectedGroups = new WeakMap<ChunkGroup, boolean>();

    compiler.hooks.thisCompilation.tap("IsolatedStylesPlugin", current => {
        compilation = current;
        selectedGroups = new WeakMap();
    });

    const selected = (group: ChunkGroup): boolean => {
        const cached = selectedGroups.get(group);

        if (cached !== undefined) {
            return cached;
        }

        const pending = [group];
        const visited = new Set<ChunkGroup>();

        while (pending.length) {
            const parent = pending.pop()!;

            if (visited.has(parent)) {
                continue;
            }

            visited.add(parent);

            if (parent.isInitial() && parent.name !== undefined && test(parent.name)) {
                selectedGroups.set(group, true);

                return true;
            }

            pending.push(...parent.getParents());
        }

        selectedGroups.set(group, false);

        return false;
    };

    return {
        type: "css/mini-extract",
        layer: DocumentStylesLayer,
        chunks: (chunk: Chunk): boolean => {
            const modules = compilation.chunkGraph.getChunkModulesIterable(chunk);

            if (![...modules].some(module => module.type === "css/mini-extract")) {
                return false;
            }

            return [...chunk.groupsIterable].some(selected);
        },
        enforce: true,
        name: false,
        priority: 100,
    };
};
