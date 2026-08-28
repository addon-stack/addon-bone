import {type OptimizationSplitChunksCacheGroupTestFn} from "@rspack/core";

export const onlyViaTopLevelEntry = (entryTypes: string | string[]): OptimizationSplitChunksCacheGroupTestFn => {
    const types = Array.isArray(entryTypes) ? entryTypes : [entryTypes];

    return (module, {chunkGraph}) => {
        const chunks = chunkGraph.getModuleChunks(module);

        if (chunks.length === 0) {
            return false;
        }

        return chunks.every(chunk => {
            const name = chunk.name;

            if (!name) {
                return false;
            }

            return types.some(type => name === type || name.endsWith(`.${type}`));
        });
    };
};
