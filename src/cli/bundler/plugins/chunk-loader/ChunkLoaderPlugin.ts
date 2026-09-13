import {type Chunk, type Compiler, RuntimeGlobals, RuntimeModule} from "@rspack/core";

import {renderChunkLoaderRuntime} from "./templates";

const PluginName = "ChunkLoaderPlugin";

export interface ChunkLoaderPluginOptions {
    test: (entry: string) => boolean;
}

class ChunkLoaderRuntimeModule extends RuntimeModule {
    public constructor() {
        super("extension native chunk loading", RuntimeModule.STAGE_TRIGGER);
    }

    public generate(): string {
        return renderChunkLoaderRuntime({
            ensureChunk: RuntimeGlobals.ensureChunk,
            loadScript: RuntimeGlobals.loadScript,
            publicPath: RuntimeGlobals.publicPath,
        });
    }
}

export default class ChunkLoaderPlugin {
    public constructor(private readonly options: ChunkLoaderPluginOptions) {}

    public apply(compiler: Compiler): void {
        compiler.hooks.thisCompilation.tap(PluginName, compilation => {
            const injected = new Set<Chunk>();

            compilation.hooks.additionalTreeRuntimeRequirements.tap(
                {name: PluginName, stage: 10_000},
                (chunk, requirements) => {
                    if (
                        chunk.name === undefined ||
                        !this.options.test(chunk.name) ||
                        chunk.getAllAsyncChunks().length === 0 ||
                        injected.has(chunk)
                    ) {
                        return;
                    }

                    requirements.add(RuntimeGlobals.loadScript);
                    requirements.add(RuntimeGlobals.ensureChunk);
                    requirements.add(RuntimeGlobals.publicPath);

                    injected.add(chunk);
                    compilation.addRuntimeModule(chunk, new ChunkLoaderRuntimeModule());
                }
            );
        });
    }
}
