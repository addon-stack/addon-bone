import {type Chunk, type Compiler, RuntimeGlobals, RuntimeModule} from "@rspack/core";

const PluginName = "ChunkLoaderPlugin";

export interface ChunkLoaderPluginOptions {
    test: (entry: string) => boolean;
}

class ChunkLoaderRuntimeModule extends RuntimeModule {
    public constructor() {
        super("extension native chunk loading", RuntimeModule.STAGE_TRIGGER);
    }

    public generate(): string {
        const ensureChunk = RuntimeGlobals.ensureChunk;
        const loadScript = RuntimeGlobals.loadScript;
        const publicPath = RuntimeGlobals.publicPath;

        return `var resolveExtensionChunkPublicPath = function() {
            if (!${publicPath}) {
                var extensionApi = globalThis.browser && globalThis.browser.runtime && globalThis.browser.runtime.getURL
                    ? globalThis.browser
                    : globalThis.chrome;

                if (!extensionApi || !extensionApi.runtime || !extensionApi.runtime.getURL) {
                    return Promise.reject(new Error("Unable to resolve the extension URL for chunk loading"));
                }

                ${publicPath} = extensionApi.runtime.getURL("/");
            }

            return Promise.resolve();
        };

        var ensureExtensionChunk = ${ensureChunk};

        ${ensureChunk} = function(chunkId) {
            return resolveExtensionChunkPublicPath().then(function() {
                return ensureExtensionChunk(chunkId);
            });
        };

        ${loadScript} = function(url, done) {
            import(url).then(
                function() {
                    done({type: "load", target: {src: url}});
                },
                function(error) {
                    done({type: "error", target: {src: url}, error: error});
                }
            );
        };`;
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
