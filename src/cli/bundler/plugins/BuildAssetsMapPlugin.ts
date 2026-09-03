import {
    AssetInfo,
    Chunk,
    Compilation,
    Compiler,
    Filename,
    PathData,
    RuntimeGlobals,
    RuntimeModule,
    sources,
} from "@rspack/core";
import stringify from "json-stringify-deterministic";
import ts from "typescript";

import {collectBuildAssets, setCompilationBuildAssets} from "@cli/bundler/utils/output";
import {toPosix} from "@cli/utils/path";

import type {EntrypointAssetsMap, EntrypointAssets} from "@typing/entrypoint";

const PluginName = "BuildAssetsMapPlugin";
// Replaced with the full map once Rspack has resolved the output filenames.
const FullMapPlaceholder = "__ADNBN_BUILD_ASSETS_FULL_MAP_PLACEHOLDER__";
// These JSON envelope keys let final validation locate each map after minification.
const FullMapEnvelopeKey = "__adnbnBuildAssetsFullMap__";
const CurrentMapEnvelopeKey = "__adnbnBuildAssetsCurrentMap__";
const MapProperty = "__adnbnBuildAssets";
const CurrentMapProperty = "__adnbnCurrentEntrypointAssets";
const CssContentHashType = "css/mini-extract";
const JavaScriptContentHashType = "javascript";
const UnsupportedCallbackHashError =
    "Build assets filename callbacks cannot read PathData hash values; return [contenthash], [chunkhash], or [fullhash] placeholders instead";

// Hash-based output names are fixed when processAssets starts, so the asset graph is frozen here.
const EmbedStage = Number.NEGATIVE_INFINITY;
const FinalValidationStage = Infinity;

interface FullMapRuntime {
    readonly name: string;
    readonly runtime: Chunk;
}

export interface BuildAssetsMapPluginOptions {
    readonly buildHashSalt?: string;
    readonly cssChunkFilename: Filename;
    readonly cssFilename: Filename;
    readonly fullMapEntrypoint: string;
}

type FilenameTemplateCache = Map<Filename, Map<Chunk, Map<string, string>>>;
type RuntimeModuleFingerprints = Map<Chunk, Map<string, string>>;

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

const resolveFilenameTemplate = (
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

const resolveChunkFilename = (
    compilation: Compilation,
    chunk: Chunk,
    filename: Filename,
    contentHashType: string
): string => {
    const data = getFilenamePathData(compilation, chunk, contentHashType);
    const template = resolveFilenameTemplate(compilation, chunk, filename, contentHashType);

    return toPosix(compilation.getPath(template, data));
};

const filenameRequiresFullHash = (
    compilation: Compilation,
    chunk: Chunk,
    filename: Filename,
    contentHashType: string
): boolean => {
    const template = resolveFilenameTemplate(compilation, chunk, filename, contentHashType);
    const callbackUsesHash = typeof filename === "function" && /\b(?:fullHash|hash)\b/.test(filename.toString());

    return callbackUsesHash || /\[(?:fullhash|hash)(?::\d+)?\]/i.test(template);
};

const validateAsyncChunkFilenames = (compilation: Compilation, cssChunkFilename: Filename): void => {
    const asyncChunks = new Set(
        Array.from(compilation.entrypoints.values()).flatMap(entrypoint => {
            return Array.from(entrypoint.getEntrypointChunk().getAllAsyncChunks());
        })
    );
    const validate = (
        filename: Filename,
        chunks: Iterable<Chunk>,
        contentHashType: string,
        assetType: "CSS" | "JavaScript",
        configName: "cssFilename" | "jsFilename"
    ): void => {
        if (typeof filename !== "function") {
            return;
        }

        const returnsFullHash = Array.from(chunks).some(chunk => {
            const template = resolveFilenameTemplate(compilation, chunk, filename, contentHashType);

            return /\[(?:fullhash|hash)(?::\d+)?\]/i.test(template);
        });

        if (returnsFullHash) {
            const target = assetType === "JavaScript" ? "async chunk URLs" : "async CSS chunk URLs";

            throw new Error(
                `Rspack cannot generate ${target} when a filename callback returns [fullhash]; configure ${configName} as a string template instead`
            );
        }
    };

    if (compilation.outputOptions.chunkFilename) {
        validate(
            compilation.outputOptions.chunkFilename,
            asyncChunks,
            JavaScriptContentHashType,
            "JavaScript",
            "jsFilename"
        );
    }
    validate(
        cssChunkFilename,
        Array.from(asyncChunks).filter(chunk => chunkHasCss(compilation, chunk)),
        CssContentHashType,
        "CSS",
        "cssFilename"
    );
};

const chunkHasCss = (compilation: Compilation, chunk: Chunk): boolean => {
    return Array.from(compilation.chunkGraph.getChunkModulesIterable(chunk)).some(module => {
        return module.type === CssContentHashType;
    });
};

const getEntrypointRuntimeAssets = (
    compilation: Compilation,
    name: string,
    cssFilename: Filename,
    cssChunkFilename: Filename
): EntrypointAssets => {
    const entrypoint = compilation.entrypoints.get(name);

    if (!entrypoint) {
        throw new Error(`Build assets entrypoint "${name}" is unavailable`);
    }

    const entryChunk = entrypoint.getEntrypointChunk();
    const initialChunks = Array.from(entrypoint.chunks);
    const asyncChunks = Array.from(entryChunk.getAllAsyncChunks());
    const jsFilename = compilation.outputOptions.filename;
    const jsChunkFilename = compilation.outputOptions.chunkFilename;

    if (!jsFilename || !jsChunkFilename) {
        throw new Error("Build assets require output.filename and output.chunkFilename");
    }

    return {
        initial: {
            js: initialChunks.map(chunk => {
                return resolveChunkFilename(
                    compilation,
                    chunk,
                    chunk === entryChunk ? jsFilename : jsChunkFilename,
                    JavaScriptContentHashType
                );
            }),
            css: initialChunks
                .filter(chunk => chunkHasCss(compilation, chunk))
                .map(chunk => {
                    return resolveChunkFilename(
                        compilation,
                        chunk,
                        chunk === entryChunk ? cssFilename : cssChunkFilename,
                        CssContentHashType
                    );
                }),
        },
        async: {
            js: asyncChunks.map(chunk => {
                return resolveChunkFilename(compilation, chunk, jsChunkFilename, JavaScriptContentHashType);
            }),
            css: asyncChunks
                .filter(chunk => chunkHasCss(compilation, chunk))
                .map(chunk => {
                    return resolveChunkFilename(compilation, chunk, cssChunkFilename, CssContentHashType);
                }),
        },
    };
};

const entrypointRuntimeUsesFullHash = (
    compilation: Compilation,
    name: string,
    cssFilename: Filename,
    cssChunkFilename: Filename
): boolean => {
    const entrypoint = compilation.entrypoints.get(name);

    if (!entrypoint) {
        return false;
    }

    const entryChunk = entrypoint.getEntrypointChunk();
    const initialChunks = Array.from(entrypoint.chunks);
    const asyncChunks = Array.from(entryChunk.getAllAsyncChunks());
    const jsFilename = compilation.outputOptions.filename;
    const jsChunkFilename = compilation.outputOptions.chunkFilename;

    if (!jsFilename || !jsChunkFilename) {
        return false;
    }

    return (
        initialChunks.some(chunk => {
            const js = filenameRequiresFullHash(
                compilation,
                chunk,
                chunk === entryChunk ? jsFilename : jsChunkFilename,
                JavaScriptContentHashType
            );
            const css =
                chunkHasCss(compilation, chunk) &&
                filenameRequiresFullHash(
                    compilation,
                    chunk,
                    chunk === entryChunk ? cssFilename : cssChunkFilename,
                    CssContentHashType
                );

            return js || css;
        }) ||
        asyncChunks.some(chunk => {
            const js = filenameRequiresFullHash(compilation, chunk, jsChunkFilename, JavaScriptContentHashType);
            const css =
                chunkHasCss(compilation, chunk) &&
                filenameRequiresFullHash(compilation, chunk, cssChunkFilename, CssContentHashType);

            return js || css;
        })
    );
};

const getChunkKey = (chunk: Chunk): string => {
    return `${String(chunk.name ?? "")}:${String(chunk.id ?? "")}`;
};

const getFullMapRuntime = (compilation: Compilation, name: string): FullMapRuntime | undefined => {
    const entrypoint = compilation.entrypoints.get(name);

    if (!entrypoint) {
        return;
    }

    return {name, runtime: entrypoint.getRuntimeChunk()};
};

const getFullMapRuntimeFiles = (fullMap: FullMapRuntime, assets: EntrypointAssetsMap): readonly string[] => {
    const runtimeFiles = new Set(Array.from(fullMap.runtime.files, toPosix));

    return assets[fullMap.name].initial.js.filter(file => runtimeFiles.has(file));
};

const validateEntrypointRuntimes = (compilation: Compilation): void => {
    for (const [name, entrypoint] of compilation.entrypoints) {
        if (entrypoint.getRuntimeChunk() !== entrypoint.getEntrypointChunk()) {
            throw new Error(
                `Build assets require a self-contained runtime for entrypoint "${name}"; disable optimization.runtimeChunk`
            );
        }
    }
};

const validateFullMapEntrypoint = (compilation: Compilation, name: string): void => {
    const entrypoint = compilation.entrypoints.get(name);

    if (!entrypoint) {
        return;
    }

    const entryChunk = entrypoint.getEntrypointChunk();
    const initialChunks = Array.from(entrypoint.chunks);
    const asyncChunks = Array.from(entryChunk.getAllAsyncChunks());

    if (initialChunks.length !== 1 || initialChunks[0] !== entryChunk || asyncChunks.length > 0) {
        throw new Error(
            `Full build-assets entrypoint "${name}" must be a single self-contained chunk; async chunks are not supported`
        );
    }
};

const validateFullMapAssets = (assets: EntrypointAssetsMap, name: string): void => {
    const entrypoint = assets[name];

    if (!entrypoint) {
        return;
    }

    if (entrypoint.initial.js.length !== 1 || entrypoint.async.js.length > 0) {
        throw new Error(
            `Full build-assets entrypoint "${name}" must emit exactly one initial JavaScript file and no async JavaScript files`
        );
    }
};

const serializeFilename = (filename: unknown): string => {
    return typeof filename === "function" ? filename.toString() : JSON.stringify(filename);
};

const collectRuntimeModuleFingerprints = (compilation: Compilation): RuntimeModuleFingerprints => {
    const fingerprints: RuntimeModuleFingerprints = new Map();

    compilation.hooks.runtimeModule.tap(PluginName, (runtimeModule, chunk) => {
        if (runtimeModule.identifier().startsWith("webpack/runtime/build assets ")) {
            return;
        }

        let chunkFingerprints = fingerprints.get(chunk);

        if (!chunkFingerprints) {
            chunkFingerprints = new Map();
            fingerprints.set(chunk, chunkFingerprints);
        }

        chunkFingerprints.set(`${runtimeModule.stage}:${runtimeModule.identifier()}`, runtimeModule.generate());
    });

    return fingerprints;
};

const updateBuildAssetsChunkHashes = (
    compilation: Compilation,
    options: Required<BuildAssetsMapPluginOptions>,
    runtimeModuleFingerprints: RuntimeModuleFingerprints
): void => {
    compilation.hooks.chunkHash.tap(PluginName, (chunk, hash) => {
        const runtimeEntry = Array.from(compilation.entrypoints).find(([, entrypoint]) => {
            return entrypoint.getRuntimeChunk() === chunk;
        });

        if (!runtimeEntry) {
            return;
        }

        const [runtimeName] = runtimeEntry;
        const fullMap = runtimeName === options.fullMapEntrypoint;
        const entries = fullMap
            ? Array.from(compilation.entrypoints).toSorted(([left], [right]) => left.localeCompare(right))
            : [runtimeEntry];

        hash.update(`${PluginName}:runtime-map:${runtimeName}`, "utf8");
        hash.update(options.buildHashSalt, "utf8");
        hash.update(serializeFilename(compilation.outputOptions.filename), "utf8");
        hash.update(serializeFilename(compilation.outputOptions.chunkFilename), "utf8");
        hash.update(serializeFilename(options.cssFilename), "utf8");
        hash.update(serializeFilename(options.cssChunkFilename), "utf8");

        if (fullMap) {
            hash.update(serializeFilename(compilation.outputOptions.assetModuleFilename), "utf8");
        }

        for (const [entryName, entrypoint] of entries) {
            hash.update(entryName, "utf8");

            const entryChunk = entrypoint.getEntrypointChunk();
            const initialChunks = new Set(entrypoint.chunks);
            const chunks = Array.from(entryChunk.getAllReferencedChunks()).toSorted((left, right) =>
                getChunkKey(left).localeCompare(getChunkKey(right))
            );

            for (const referencedChunk of chunks) {
                const category = initialChunks.has(referencedChunk) ? "initial" : "async";

                hash.update(`${category}:${getChunkKey(referencedChunk)}`, "utf8");

                const jsFilename =
                    referencedChunk === entryChunk
                        ? compilation.outputOptions.filename
                        : compilation.outputOptions.chunkFilename;

                if (jsFilename) {
                    const template = resolveFilenameTemplate(
                        compilation,
                        referencedChunk,
                        jsFilename,
                        JavaScriptContentHashType
                    );

                    hash.update(`javascript-template:${template}`, "utf8");
                }

                if (chunkHasCss(compilation, referencedChunk)) {
                    const cssFilename = referencedChunk === entryChunk ? options.cssFilename : options.cssChunkFilename;
                    const template = resolveFilenameTemplate(
                        compilation,
                        referencedChunk,
                        cssFilename,
                        CssContentHashType
                    );

                    hash.update(`css-template:${template}`, "utf8");
                }

                const moduleHashes = Array.from(
                    compilation.chunkGraph.getChunkModulesIterable(referencedChunk),
                    module => {
                        return compilation.chunkGraph.getModuleHash(module, new Set(referencedChunk.runtime)) ?? "";
                    }
                ).toSorted();

                moduleHashes.forEach(moduleHash => hash.update(moduleHash, "utf8"));

                const runtimeFingerprints = runtimeModuleFingerprints.get(referencedChunk);

                if (runtimeFingerprints) {
                    Array.from(runtimeFingerprints)
                        .toSorted(([left], [right]) => left.localeCompare(right))
                        .forEach(([identifier, source]) => {
                            hash.update(`runtime-module:${identifier}`, "utf8");
                            hash.update(source, "utf8");
                        });
                }
            }
        }
    });
};

class BuildAssetsRuntimeModule extends RuntimeModule {
    public constructor(
        private readonly fullMap: boolean,
        private readonly runtimeName: string,
        private readonly cssFilename: Filename,
        private readonly cssChunkFilename: Filename,
        fullHash: boolean
    ) {
        super(`build assets ${fullMap ? "full" : "current"} ${runtimeName}`, RuntimeModule.STAGE_TRIGGER);

        if (!fullMap) {
            this.dependentHash = true;
            this.fullHash = fullHash;
        }
    }

    public generate(): string {
        const runtime = RuntimeGlobals.require;

        if (this.fullMap) {
            return `${runtime}.${MapProperty} = JSON.parse(${JSON.stringify(FullMapPlaceholder)}).${FullMapEnvelopeKey};`;
        }

        const compilation = this.compilation;

        if (!compilation) {
            throw new Error("Build assets runtime is not attached to a compilation");
        }

        const current = getEntrypointRuntimeAssets(
            compilation,
            this.runtimeName,
            this.cssFilename,
            this.cssChunkFilename
        );

        const envelope = JSON.stringify({[CurrentMapEnvelopeKey]: current});

        return `${runtime}.${CurrentMapProperty} = JSON.parse(${JSON.stringify(envelope)}).${CurrentMapEnvelopeKey};`;
    }
}

const replaceFullMapPlaceholder = (
    compilation: Compilation,
    runtimeFiles: readonly string[],
    assets: EntrypointAssetsMap
): void => {
    const placeholder = JSON.stringify(FullMapPlaceholder);
    const replacementValue = JSON.stringify(JSON.stringify({[FullMapEnvelopeKey]: assets}));
    let replacements = 0;

    for (const file of runtimeFiles) {
        const asset = compilation.getAsset(file);

        if (!asset) {
            continue;
        }

        const code = asset.source.source().toString();
        const start = code.indexOf(placeholder);

        if (start < 0) {
            continue;
        }

        if (code.indexOf(placeholder, start + placeholder.length) >= 0) {
            throw new Error(`Build assets placeholder occurs more than once in "${file}"`);
        }

        const source = new sources.ReplaceSource(asset.source);

        source.replace(start, start + placeholder.length - 1, replacementValue);
        compilation.updateAsset(file, source);
        replacements += 1;
    }

    if (replacements !== 1) {
        throw new Error(`Expected one full build-assets runtime, found ${replacements}`);
    }
};

const extractEmbeddedEnvelope = <T>(file: string, source: string, key: string): T => {
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
    const values: T[] = [];

    const visit = (node: ts.Node): void => {
        if (ts.isStringLiteralLike(node) && node.text.includes(key)) {
            try {
                const envelope = JSON.parse(node.text) as Record<string, T>;

                if (Object.prototype.hasOwnProperty.call(envelope, key)) {
                    values.push(envelope[key]);
                }
            } catch {}
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    if (values.length !== 1) {
        throw new Error(`Expected one embedded build assets value in "${file}", found ${values.length}`);
    }

    return values[0];
};

const extractEmbeddedMap = (file: string, source: string): EntrypointAssetsMap => {
    return extractEmbeddedEnvelope<EntrypointAssetsMap>(file, source, FullMapEnvelopeKey);
};

const validateEmbeddedMap = (compilation: Compilation, fullMap: FullMapRuntime, assets: EntrypointAssetsMap): void => {
    const runtimeFiles = getFullMapRuntimeFiles(fullMap, assets);
    const runtime = runtimeFiles
        .map(file => ({file, source: compilation.getAsset(file)?.source.source().toString() ?? ""}))
        .find(({source}) => source.length > 0);

    if (!runtime) {
        throw new Error(
            `Full build-assets runtime for entrypoint "${fullMap.name}" is unavailable after asset processing`
        );
    }

    const embedded = extractEmbeddedMap(runtime.file, runtime.source);

    if (stringify(embedded) !== stringify(assets)) {
        throw new Error(
            "Build assets changed after the runtime map was embedded; finalize entrypoint assets before processAssets begins"
        );
    }
};

const validateCurrentEntrypointMaps = (
    compilation: Compilation,
    assets: EntrypointAssetsMap,
    fullMapEntrypoint: string
): void => {
    for (const [name, entrypointAssets] of Object.entries(assets)) {
        if (name === fullMapEntrypoint) {
            continue;
        }

        const entrypoint = compilation.entrypoints.get(name);

        if (!entrypoint) {
            throw new Error(`Build assets entrypoint "${name}" is unavailable`);
        }

        const runtimeFiles = new Set(Array.from(entrypoint.getRuntimeChunk().files, toPosix));
        const runtime = entrypointAssets.initial.js
            .filter(file => runtimeFiles.has(file))
            .map(file => ({file, source: compilation.getAsset(file)?.source.source().toString() ?? ""}))
            .find(({source}) => source.length > 0);

        if (!runtime) {
            throw new Error(`Runtime map for entrypoint "${name}" is unavailable after asset processing`);
        }

        const runtimeAssets = extractEmbeddedEnvelope<EntrypointAssets>(
            runtime.file,
            runtime.source,
            CurrentMapEnvelopeKey
        );
        const finalizedAssets: EntrypointAssets = {
            initial: entrypointAssets.initial,
            async: entrypointAssets.async,
        };

        if (stringify(runtimeAssets) !== stringify(finalizedAssets)) {
            throw new Error(`Build assets changed after the runtime map for entrypoint "${name}" was embedded`);
        }
    }
};

const finalizeBuildAssets = (compilation: Compilation, options: Required<BuildAssetsMapPluginOptions>): void => {
    const assets = collectBuildAssets(compilation);
    const fullMap = getFullMapRuntime(compilation, options.fullMapEntrypoint);

    validateFullMapAssets(assets, options.fullMapEntrypoint);

    if (fullMap) {
        validateEmbeddedMap(compilation, fullMap, assets);
    }

    validateCurrentEntrypointMaps(compilation, assets, options.fullMapEntrypoint);

    setCompilationBuildAssets(compilation, assets);
};

export default class BuildAssetsMapPlugin {
    private readonly options: Required<BuildAssetsMapPluginOptions>;

    public constructor(options: BuildAssetsMapPluginOptions) {
        this.options = {
            ...options,
            buildHashSalt: options.buildHashSalt ?? "",
        };
    }

    public apply(compiler: Compiler): void {
        compiler.hooks.thisCompilation.tap({name: PluginName, stage: EmbedStage}, compilation => {
            const injectedRuntimes = new Set<Chunk>();
            let filenamesValidated = false;
            let runtimesValidated = false;
            const runtimeModuleFingerprints = collectRuntimeModuleFingerprints(compilation);

            updateBuildAssetsChunkHashes(compilation, this.options, runtimeModuleFingerprints);

            compilation.hooks.additionalTreeRuntimeRequirements.tap(PluginName, chunk => {
                if (!runtimesValidated) {
                    validateEntrypointRuntimes(compilation);
                    validateFullMapEntrypoint(compilation, this.options.fullMapEntrypoint);
                    runtimesValidated = true;
                }

                if (!filenamesValidated) {
                    validateAsyncChunkFilenames(compilation, this.options.cssChunkFilename);
                    filenamesValidated = true;
                }

                const runtimeEntry = Array.from(compilation.entrypoints).find(([, entrypoint]) => {
                    return entrypoint.getRuntimeChunk() === chunk;
                });

                if (!runtimeEntry || injectedRuntimes.has(chunk)) {
                    return;
                }

                const [runtimeName] = runtimeEntry;

                injectedRuntimes.add(chunk);
                compilation.addRuntimeModule(
                    chunk,
                    new BuildAssetsRuntimeModule(
                        runtimeName === this.options.fullMapEntrypoint,
                        runtimeName,
                        this.options.cssFilename,
                        this.options.cssChunkFilename,
                        entrypointRuntimeUsesFullHash(
                            compilation,
                            runtimeName,
                            this.options.cssFilename,
                            this.options.cssChunkFilename
                        )
                    )
                );
            });

            compilation.hooks.processAssets.tap(
                {
                    name: PluginName,
                    stage: EmbedStage,
                },
                () => {
                    const assets = collectBuildAssets(compilation);
                    const fullMap = getFullMapRuntime(compilation, this.options.fullMapEntrypoint);

                    validateFullMapAssets(assets, this.options.fullMapEntrypoint);
                    setCompilationBuildAssets(compilation, assets);

                    if (fullMap) {
                        replaceFullMapPlaceholder(compilation, getFullMapRuntimeFiles(fullMap, assets), assets);
                    }
                }
            );

            compilation.hooks.processAssets.tap(
                {
                    name: `${PluginName}:finalize`,
                    stage: Compilation.PROCESS_ASSETS_STAGE_ANALYSE,
                },
                () => finalizeBuildAssets(compilation, this.options)
            );
        });

        // Register after every afterPlugins callback, then run after ordinary emit taps but before files are written.
        compiler.hooks.afterPlugins.intercept({
            name: `${PluginName}:registerFinalValidation`,
            done: () => {
                compiler.hooks.emit.tap(
                    {name: `${PluginName}:finalValidation`, stage: FinalValidationStage},
                    compilation => {
                        finalizeBuildAssets(compilation, this.options);
                    }
                );
            },
        });
    }
}
