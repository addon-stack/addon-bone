import runtimeTemplate from "./templates/runtime.template.js?raw";

import {renderRuntimeTemplate} from "@cli/bundler/utils/runtime-template";

interface ChunkLoaderRuntimeTemplateOptions {
    readonly ensureChunk: string;
    readonly loadScript: string;
    readonly publicPath: string;
}

export const renderChunkLoaderRuntime = (options: ChunkLoaderRuntimeTemplateOptions): string => {
    return renderRuntimeTemplate(runtimeTemplate, {
        __ADNBN_ENSURE_CHUNK__: options.ensureChunk,
        __ADNBN_LOAD_SCRIPT__: options.loadScript,
        __ADNBN_PUBLIC_PATH__: options.publicPath,
    });
};
