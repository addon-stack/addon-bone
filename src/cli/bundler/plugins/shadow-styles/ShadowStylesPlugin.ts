import {type Chunk, type Compiler, RuntimeGlobals, RuntimeModule} from "@rspack/core";

import {ShadowStylesRuntimeProperty} from "@entry/content/core/shadow-styles";

import {renderShadowStylesCssLoader, renderShadowStylesRuntime} from "./templates";

const PluginName = "ShadowStylesPlugin";
const CssLoadingRuntimeIdentifier = "webpack/runtime/css loading";
const CssRuntimeBoundary = "// object to store loaded CSS chunks";
const CssFilenameExpression = /var href = (.+?)\(chunkId\);/;

export {ShadowStylesRuntimeProperty};

export interface ShadowStylesPluginOptions {
    test: (entry: string) => boolean;
    timeout?: number;
}

class ShadowStylesRuntimeModule extends RuntimeModule {
    public constructor(
        private readonly entry: string,
        private readonly timeout: number
    ) {
        super(`shadow styles ${entry}`, RuntimeModule.STAGE_ATTACH);
    }

    public generate(): string {
        return renderShadowStylesRuntime({
            entry: this.entry,
            require: RuntimeGlobals.require,
            runtimeProperty: ShadowStylesRuntimeProperty,
            timeout: this.timeout,
        });
    }
}

const hasAsyncCss = (chunk: Chunk): boolean => {
    return Array.from(chunk.getAllAsyncChunks()).some(candidate => {
        return [...candidate.files, ...candidate.auxiliaryFiles].some(file => file.endsWith(".css"));
    });
};

export default class ShadowStylesPlugin {
    private readonly originalRuntimeSources = new WeakMap<RuntimeModule, string>();

    public constructor(private readonly options: ShadowStylesPluginOptions) {}

    public apply(compiler: Compiler): void {
        const timeout = this.options.timeout ?? compiler.options.output.chunkLoadTimeout ?? 120_000;

        compiler.hooks.thisCompilation.tap(PluginName, compilation => {
            const injected = new Set<Chunk>();
            const patched = new Set<Chunk>();

            compilation.hooks.additionalTreeRuntimeRequirements.tap(PluginName, (chunk, requirements) => {
                if (chunk.name === undefined || !this.options.test(chunk.name) || injected.has(chunk)) {
                    return;
                }

                requirements.add(RuntimeGlobals.require);
                requirements.add(RuntimeGlobals.publicPath);
                injected.add(chunk);
                compilation.addRuntimeModule(chunk, new ShadowStylesRuntimeModule(chunk.name, timeout));
            });

            compilation.hooks.runtimeModule.tap(PluginName, (runtimeModule, chunk) => {
                if (chunk.name === undefined || runtimeModule.identifier() !== CssLoadingRuntimeIdentifier) {
                    return;
                }

                const source = runtimeModule.source;

                if (!source || typeof source.source !== "string") {
                    throw new Error(`CSS loading runtime source for shadow entrypoint "${chunk.name}" is unavailable`);
                }

                if (source.source.length === 0) {
                    return;
                }

                const originalSource = this.originalRuntimeSources.get(runtimeModule) ?? source.source;
                this.originalRuntimeSources.set(runtimeModule, originalSource);
                source.source = originalSource;

                if (!this.options.test(chunk.name)) {
                    return;
                }

                const boundary = originalSource.indexOf(CssRuntimeBoundary);
                const filenameExpression = originalSource.match(CssFilenameExpression)?.[1];

                if (boundary < 0 || !filenameExpression) {
                    throw new Error(`CSS loading runtime seam for shadow entrypoint "${chunk.name}" is unavailable`);
                }

                source.source = renderShadowStylesCssLoader({
                    cssFilenameExpression: filenameExpression,
                    originalRuntime: originalSource.slice(boundary),
                    publicPath: RuntimeGlobals.publicPath,
                    require: RuntimeGlobals.require,
                    runtimeProperty: ShadowStylesRuntimeProperty,
                });
                patched.add(chunk);
            });

            compilation.hooks.afterSeal.tap(PluginName, () => {
                for (const entrypoint of compilation.entrypoints.values()) {
                    const chunk = entrypoint.getRuntimeChunk();

                    if (
                        chunk &&
                        chunk.name !== undefined &&
                        this.options.test(chunk.name) &&
                        hasAsyncCss(entrypoint.getEntrypointChunk()) &&
                        !patched.has(chunk)
                    ) {
                        throw new Error(`CSS loading runtime for shadow entrypoint "${chunk.name}" was not replaced`);
                    }
                }
            });
        });
    }
}
