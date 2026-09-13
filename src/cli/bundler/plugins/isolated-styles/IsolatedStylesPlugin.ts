import {type Chunk, type Compilation, type Compiler, type Filename, RuntimeGlobals, RuntimeModule} from "@rspack/core";

import {getIsolatedStylesFiles, isIsolatedStylesChunk} from "@cli/bundler/utils/styles";
import {CssContentHashType, filenameRequiresFullHash, resolveChunkFilename} from "@cli/bundler/utils/chunk-filename";
import type {RuntimePropertyOptions} from "../types";
import {getManifestHooks} from "../utils/manifest-hooks";

import {renderIsolatedStylesCssLoader, renderIsolatedStylesRuntime} from "./templates";

const PluginName = "IsolatedStylesPlugin";
const CssLoadingRuntimeIdentifier = "webpack/runtime/css loading";
const CssRuntimeBoundary = "// object to store loaded CSS chunks";
const CssFilenameExpression = /var href = (.+?)\(chunkId\);/;

export interface IsolatedStylesPluginOptions extends RuntimePropertyOptions {
    cssFilename: Filename;
    cssChunkFilename: Filename;
    test: (entry: string) => boolean;
    timeout?: number;
    /** Inspects every entry's initial, shared and async CSS, independently of test. Throw to reject; return warning messages to report without changing delivery. */
    validate?: (entry: string, files: IsolatedStylesPluginFiles) => void | readonly string[];
}

/** CSS destinations in one entrypoint's complete dependency graph, for build diagnostics only. */
export interface IsolatedStylesPluginFiles {
    readonly document: readonly string[];
    readonly isolated: readonly string[];
}

class IsolatedStylesRuntimeModule extends RuntimeModule {
    public constructor(
        private readonly entry: string,
        private readonly property: string,
        private readonly timeout: number,
        private readonly cssFilename: Filename,
        private readonly cssChunkFilename: Filename,
        fullHash: boolean
    ) {
        super(`isolated styles ${entry}`, RuntimeModule.STAGE_ATTACH);
        this.dependentHash = true;
        this.fullHash = fullHash;
    }

    public generate(): string {
        const compilation = this.compilation;
        if (!compilation) throw new Error("Isolated styles runtime is not attached to a compilation");

        const initialStyles = initialStyleChunks(compilation, this.entry, this.cssFilename, this.cssChunkFilename).map(
            ({chunk, filename}) => resolveChunkFilename(compilation, chunk, filename, CssContentHashType)
        );

        return renderIsolatedStylesRuntime({
            entry: this.entry,
            require: RuntimeGlobals.require,
            property: this.property,
            timeout: this.timeout,
            initialStyles,
        });
    }
}

const initialStyleChunks = (
    compilation: Compilation,
    entry: string,
    cssFilename: Filename,
    cssChunkFilename: Filename
): {chunk: Chunk; filename: Filename}[] => {
    const entrypoint = compilation.entrypoints.get(entry);
    if (!entrypoint) throw new Error(`Isolated styles entrypoint "${entry}" is unavailable`);

    const entryChunk = entrypoint.getEntrypointChunk();
    return Array.from(entrypoint.chunks)
        .filter(chunk => isIsolatedStylesChunk(compilation, chunk))
        .map(chunk => ({chunk, filename: chunk === entryChunk ? cssFilename : cssChunkFilename}));
};

const hasAsyncCss = (chunk: Chunk): boolean => {
    return Array.from(chunk.getAllAsyncChunks()).some(candidate => {
        return [...candidate.files, ...candidate.auxiliaryFiles].some(file => file.endsWith(".css"));
    });
};

export default class IsolatedStylesPlugin {
    private readonly originalRuntimeSources = new WeakMap<RuntimeModule, string>();

    public constructor(private readonly options: IsolatedStylesPluginOptions) {}

    public apply(compiler: Compiler): void {
        compiler.hooks.compilation.tap(PluginName, compilation => {
            getManifestHooks(compilation).prepareDependencies.tap(PluginName, dependencies => {
                const isolatedFiles = getIsolatedStylesFiles(compilation);
                for (const [entry, dependency] of dependencies) {
                    if (!this.options.test(entry)) continue;

                    for (const file of dependency.css) {
                        if (!isolatedFiles.has(file)) continue;
                        dependency.css.delete(file);
                        dependency.assets.add(file);
                    }
                }
            });
        });

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
                const fullHash = initialStyleChunks(
                    compilation,
                    chunk.name,
                    this.options.cssFilename,
                    this.options.cssChunkFilename
                ).some(({chunk, filename}) =>
                    filenameRequiresFullHash(compilation, chunk, filename, CssContentHashType)
                );
                compilation.addRuntimeModule(
                    chunk,
                    new IsolatedStylesRuntimeModule(
                        chunk.name,
                        this.options.property,
                        timeout,
                        this.options.cssFilename,
                        this.options.cssChunkFilename,
                        fullHash
                    )
                );
            });

            compilation.hooks.runtimeModule.tap(PluginName, (runtimeModule, chunk) => {
                if (chunk.name === undefined || runtimeModule.identifier() !== CssLoadingRuntimeIdentifier) {
                    return;
                }

                const source = runtimeModule.source;

                if (!source || typeof source.source !== "string") {
                    throw new Error(
                        `CSS loading runtime source for isolated entrypoint "${chunk.name}" is unavailable`
                    );
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
                    throw new Error(`CSS loading runtime seam for isolated entrypoint "${chunk.name}" is unavailable`);
                }

                source.source = renderIsolatedStylesCssLoader({
                    isolatedChunks: Object.fromEntries(
                        [...compilation.chunks]
                            .filter(candidate => isIsolatedStylesChunk(compilation, candidate))
                            .map(candidate => [candidate.id, true])
                    ),
                    originalLoader: originalSource.slice(0, boundary),
                    cssFilenameExpression: filenameExpression,
                    originalRuntime: originalSource.slice(boundary),
                    publicPath: RuntimeGlobals.publicPath,
                    require: RuntimeGlobals.require,
                    property: this.options.property,
                });
                patched.add(chunk);
            });

            compilation.hooks.afterSeal.tap(PluginName, () => {
                for (const [entry, entrypoint] of compilation.entrypoints) {
                    const chunk = entrypoint.getRuntimeChunk();

                    if (this.options.validate) {
                        const document = new Set<string>();
                        const isolated = new Set<string>();
                        const referenced = new Set([
                            ...entrypoint.chunks,
                            ...entrypoint.getEntrypointChunk().getAllReferencedChunks(),
                        ]);
                        for (const candidate of referenced) {
                            const destination = isIsolatedStylesChunk(compilation, candidate) ? isolated : document;
                            for (const file of candidate.files) {
                                if (file.endsWith(".css")) destination.add(file);
                            }
                        }
                        const warnings = this.options.validate(entry, {
                            document: [...document].sort(),
                            isolated: [...isolated].sort(),
                        });
                        for (const message of warnings ?? []) compilation.warnings.push(new Error(message));
                    }

                    if (
                        chunk &&
                        chunk.name !== undefined &&
                        this.options.test(chunk.name) &&
                        hasAsyncCss(entrypoint.getEntrypointChunk()) &&
                        !patched.has(chunk)
                    ) {
                        throw new Error(`CSS loading runtime for isolated entrypoint "${chunk.name}" was not replaced`);
                    }
                }
            });
        });
    }
}
