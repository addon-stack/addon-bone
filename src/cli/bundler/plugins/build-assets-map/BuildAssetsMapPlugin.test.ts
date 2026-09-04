/** @jest-environment node */

import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";

import {
    Compilation,
    Compiler,
    CssExtractRspackPlugin,
    HtmlRspackPlugin,
    NormalModuleReplacementPlugin,
    RuntimeModule,
    Stats,
    rspack,
    sources,
} from "@rspack/core";
import type {Filename} from "@rspack/core";

import {appFilenameResolver, getCompilationBuildAssets} from "@cli/bundler/utils/output";

import type {EntrypointAssetsMap, EntrypointAssetsMapEntry, EntrypointAssets} from "@typing/entrypoint";

import BuildAssetsMapPlugin from "./BuildAssetsMapPlugin";

const AppName = "Build Assets Fixture";
const AppToken = "build-assets-fixture";
const UnrelatedFile = "public/unrelated.txt";
const FullMapPlaceholder = "__ADNBN_BUILD_ASSETS_FULL_MAP_PLACEHOLDER__";
const ChunkLoadingGlobal = "buildAssetsFixtureChunks";

const fixtures = path.resolve(__dirname, "tests", "fixtures");
const projectRoot = path.resolve(__dirname, "../../../../..");

interface BuildResult {
    readonly assets: EntrypointAssetsMap;
    readonly hashes: Readonly<Record<string, string>>;
    readonly sources: Readonly<Record<string, string>>;
}

interface FakeLoadEvent {
    readonly target: FakeElement;
    readonly type: "error" | "load";
}

interface FakeElement {
    href?: string;
    onerror?: (event: FakeLoadEvent) => void;
    onload?: (event: FakeLoadEvent) => void;
    parentNode?: FakeHead;
    rel?: string;
    src?: string;
    readonly tagName: string;
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
}

interface FakeHead {
    appendChild(element: FakeElement): FakeElement;
    removeChild(element: FakeElement): FakeElement;
}

interface RuntimeResult {
    readonly requested: {css: string[]; js: string[]};
    readonly sandbox: Record<string, unknown>;
}

type GetterTrace<T> = {readonly ok: true; readonly value: T} | {readonly error: string; readonly ok: false};

interface BuildAssetsGetterTrace {
    readonly current: GetterTrace<EntrypointAssets>;
    readonly full: GetterTrace<EntrypointAssetsMap>;
}

class EmitUnrelatedAssetPlugin {
    public apply(compiler: Compiler): void {
        compiler.hooks.thisCompilation.tap("EmitUnrelatedAssetPlugin", compilation => {
            compilation.hooks.processAssets.tap(
                {
                    name: "EmitUnrelatedAssetPlugin",
                    stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
                },
                () => compilation.emitAsset(UnrelatedFile, new sources.RawSource("not reachable from an entrypoint"))
            );
        });
    }
}

class BetaRuntimeModule extends RuntimeModule {
    public constructor(private readonly marker: string) {
        super("beta fixture marker", RuntimeModule.STAGE_NORMAL);
    }

    public generate(): string {
        return `globalThis.__betaRuntimeMarker = ${JSON.stringify(this.marker)};`;
    }
}

class AddBetaRuntimeModulePlugin {
    public constructor(private readonly marker: string) {}

    public apply(compiler: Compiler): void {
        compiler.hooks.thisCompilation.tap("AddBetaRuntimeModulePlugin", compilation => {
            compilation.hooks.additionalTreeRuntimeRequirements.tap("AddBetaRuntimeModulePlugin", chunk => {
                if (chunk.name === "beta") {
                    compilation.addRuntimeModule(chunk, new BetaRuntimeModule(this.marker));
                }
            });
        });
    }
}

class RenameBetaCssPlugin {
    public apply(compiler: Compiler): void {
        compiler.hooks.thisCompilation.tap("RenameBetaCssPlugin", compilation => {
            compilation.hooks.processAssets.tap(
                {
                    name: "RenameBetaCssPlugin",
                    stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
                },
                () => {
                    const css = compilation.entrypoints
                        .get("beta")
                        ?.getFiles()
                        .find(file => file.endsWith(".css"));

                    if (css) {
                        compilation.renameAsset(css, "custom/css/beta-renamed.css");
                    }
                }
            );
        });
    }
}

class RemoveBetaCssPlugin {
    public apply(compiler: Compiler): void {
        compiler.hooks.thisCompilation.tap("RemoveBetaCssPlugin", compilation => {
            compilation.hooks.processAssets.tap(
                {
                    name: "RemoveBetaCssPlugin",
                    stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
                },
                () => {
                    const css = compilation.entrypoints
                        .get("beta")
                        ?.getFiles()
                        .find(file => file.endsWith(".css"));

                    if (css) {
                        compilation.deleteAsset(css);
                    }
                }
            );
        });
    }
}

class RenameBetaCssAfterProcessAssetsPlugin {
    public apply(compiler: Compiler): void {
        compiler.hooks.thisCompilation.tap("RenameBetaCssAfterProcessAssetsPlugin", compilation => {
            compilation.hooks.afterProcessAssets.tap("RenameBetaCssAfterProcessAssetsPlugin", () => {
                const css = compilation.entrypoints
                    .get("beta")
                    ?.getFiles()
                    .find(file => file.endsWith(".css"));

                if (css) {
                    compilation.renameAsset(css, "custom/css/beta-after-process.css");
                }
            });
        });
    }
}

class RenameBetaCssAtEmitPlugin {
    public apply(compiler: Compiler): void {
        compiler.hooks.emit.tap("RenameBetaCssAtEmitPlugin", compilation => {
            const css = compilation.entrypoints
                .get("beta")
                ?.getFiles()
                .find(file => file.endsWith(".css"));

            if (css) {
                compilation.renameAsset(css, "custom/css/beta-at-emit.css");
            }
        });
    }
}

const closeCompiler = (compiler: Compiler): Promise<void> => {
    return new Promise((resolve, reject) => compiler.close(error => (error ? reject(error) : resolve())));
};

const runCompiler = (compiler: Compiler): Promise<Stats> => {
    return new Promise((resolve, reject) => {
        compiler.run((error, stats) => {
            if (error) {
                reject(error);
            } else if (!stats) {
                reject(new Error("Rspack did not return build stats"));
            } else if (stats.hasErrors()) {
                reject(new Error(stats.toString({all: false, errors: true, errorDetails: true})));
            } else {
                resolve(stats);
            }
        });
    });
};

const compile = async (
    commonChunks: boolean,
    options: {
        assetInfoFilename?: boolean;
        assertEmptyOutputOnFailure?: boolean;
        background?: "async" | "shared";
        betaDirectory?: string;
        betaRuntimeMarker?: string;
        betaCssChange?: boolean;
        buildHashSalt?: string;
        cssDir?: string;
        cssFullHashCallback?: boolean;
        fullHashCallback?: boolean;
        htmlChunks?: readonly string[];
        includeBackground?: boolean;
        jsHash?: "chunkhash" | "contenthash" | "fullhash";
        removeBetaCss?: boolean;
        renameBetaCss?: boolean;
        renameBetaCssAfterProcessAssets?: boolean;
        renameBetaCssAtEmit?: boolean;
        resolvedHashFilename?: boolean;
        separateRuntime?: boolean;
        sharedCssChunk?: boolean;
        sharedChange?: boolean;
    } = {}
): Promise<BuildResult> => {
    const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-build-assets-"));
    const jsHash = options.jsHash ?? "chunkhash";
    const jsTemplate = `[name].[app].[${jsHash}:8].js`;
    const jsFilenameConfig: Filename = options.resolvedHashFilename
        ? pathData => `[name].[app].${pathData.hash?.slice(0, 8) ?? "missing-hash"}.js`
        : options.assetInfoFilename
          ? (pathData, assetInfo) => {
                const initial = ["alpha", "background", "beta"].includes(String(pathData.chunk?.name));
                const directory = initial ? `${String(assetInfo?.assetType ?? "missing-asset-info")}/` : "";

                return `${directory}${jsTemplate}`;
            }
          : options.betaDirectory
            ? pathData => {
                  const directory = pathData.chunk?.name === "beta" ? `${options.betaDirectory}/` : "";

                  return `${directory}${jsTemplate}`;
              }
            : jsHash === "fullhash" && !options.fullHashCallback
              ? jsTemplate
              : () => jsTemplate;
    const jsFilename = appFilenameResolver(AppName, jsFilenameConfig, "custom/js");
    const cssTemplate = options.cssFullHashCallback
        ? "[name].[app].[fullhash:8].css"
        : "[name].[app].[contenthash:8].css";
    const cssFilename = appFilenameResolver(AppName, () => cssTemplate, options.cssDir ?? "custom/css");
    const assetFilename = appFilenameResolver(AppName, () => "[name].[app].[contenthash:8][ext]", "custom/assets");
    const background =
        options.background === "async"
            ? "./background-async.plan-a.js"
            : options.background === "shared"
              ? "./background-shared.plan-a.js"
              : "./background.plan-a.js";
    const compiler = rspack({
        context: fixtures,
        mode: "production",
        target: ["web", "es2020"],
        devtool: "source-map",
        entry: {
            ...(options.includeBackground === false ? {} : {background}),
            alpha: "./alpha.plan-a.js",
            beta: "./beta.plan-a.js",
        },
        output: {
            path: outputPath,
            clean: true,
            publicPath: "",
            globalObject: "globalThis",
            uniqueName: AppToken,
            chunkLoadingGlobal: ChunkLoadingGlobal,
            filename: jsFilename,
            chunkFilename: jsFilename,
            assetModuleFilename: assetFilename,
        },
        resolve: {
            alias: {
                adnbn$: path.resolve(projectRoot, "dist", "index.js"),
            },
            extensions: [".js"],
        },
        resolveLoader: {
            modules: [path.resolve(projectRoot, "node_modules"), "node_modules"],
        },
        module: {
            rules: [
                {
                    resourceQuery: /resource/,
                    type: "asset/resource",
                },
                {
                    test: /\.(?:svg|woff2)$/i,
                    type: "asset/resource",
                },
                {
                    test: /\.css$/i,
                    sideEffects: true,
                    type: "javascript/auto",
                    use: [
                        CssExtractRspackPlugin.loader,
                        {
                            loader: "css-loader",
                            options: {esModule: true, modules: false},
                        },
                    ],
                },
            ],
        },
        optimization: {
            chunkIds: "deterministic",
            moduleIds: "deterministic",
            minimize: true,
            realContentHash: true,
            runtimeChunk: options.separateRuntime ? "multiple" : false,
            splitChunks: commonChunks
                ? {
                      chunks: "all",
                      minSize: 0,
                      cacheGroups: {
                          default: false,
                          defaultVendors: false,
                          fixtureShared: {
                              test: /[\\/]shared(?:\.changed)?\.js$/,
                              name: "common",
                              minChunks: 2,
                              enforce: true,
                              reuseExistingChunk: true,
                          },
                          ...(options.sharedCssChunk
                              ? {
                                    fixtureSharedStyles: {
                                        chunks: "all",
                                        enforce: true,
                                        minChunks: 2,
                                        name: "shared-styles",
                                        test: /[\\/]shared\.css$/,
                                        type: "css/mini-extract",
                                    },
                                }
                              : {}),
                      },
                  }
                : false,
        },
        plugins: [
            new CssExtractRspackPlugin({filename: cssFilename, chunkFilename: cssFilename}),
            ...(options.betaCssChange
                ? [
                      new NormalModuleReplacementPlugin(/beta\.css$/, resource => {
                          resource.request = path.resolve(fixtures, "beta.changed.css");
                      }),
                  ]
                : []),
            ...(options.sharedChange
                ? [
                      new NormalModuleReplacementPlugin(/shared\.js$/, resource => {
                          resource.request = path.resolve(fixtures, "shared.changed.js");
                      }),
                  ]
                : []),
            ...(options.sharedCssChunk
                ? [
                      new NormalModuleReplacementPlugin(/shared\.js$/, resource => {
                          resource.request = path.resolve(fixtures, "shared-with-css.js");
                      }),
                  ]
                : []),
            ...(options.htmlChunks
                ? [new HtmlRspackPlugin({chunks: [...options.htmlChunks], filename: "fixture.html", hash: true})]
                : []),
            ...(options.renameBetaCss ? [new RenameBetaCssPlugin()] : []),
            ...(options.removeBetaCss ? [new RemoveBetaCssPlugin()] : []),
            ...(options.betaRuntimeMarker ? [new AddBetaRuntimeModulePlugin(options.betaRuntimeMarker)] : []),
            new BuildAssetsMapPlugin({
                buildHashSalt: options.buildHashSalt,
                cssChunkFilename: cssFilename,
                cssFilename,
                fullMapEntrypoint: "background",
            }),
            ...(options.renameBetaCssAfterProcessAssets ? [new RenameBetaCssAfterProcessAssetsPlugin()] : []),
            ...(options.renameBetaCssAtEmit ? [new RenameBetaCssAtEmitPlugin()] : []),
            new EmitUnrelatedAssetPlugin(),
        ],
    });

    try {
        const stats = await runCompiler(compiler);
        const assets = getCompilationBuildAssets(stats.compilation);

        if (!assets) {
            throw new Error("BuildAssetsMapPlugin did not expose the finalized map");
        }

        const emitted = stats.compilation.getAssets();
        const outputSources = Object.fromEntries(emitted.map(asset => [asset.name, asset.source.source().toString()]));
        const hashes = Object.fromEntries(
            emitted
                .filter(asset => !asset.name.endsWith(".map"))
                .map(asset => [asset.name, crypto.createHash("sha256").update(asset.source.buffer()).digest("hex")])
        );

        return {assets, hashes, sources: outputSources};
    } catch (error) {
        if (
            options.assertEmptyOutputOnFailure &&
            fs.existsSync(outputPath) &&
            fs.readdirSync(outputPath, {recursive: true}).length > 0
        ) {
            throw new Error("Rspack wrote output before build-assets validation failed", {cause: error});
        }

        throw error;
    } finally {
        await closeCompiler(compiler);
        fs.rmSync(outputPath, {force: true, recursive: true});
    }
};

const flattenEntrypoint = (entrypoint: EntrypointAssetsMapEntry): readonly string[] => {
    return [
        ...entrypoint.initial.js,
        ...entrypoint.initial.css,
        ...entrypoint.async.js,
        ...entrypoint.async.css,
        ...entrypoint.assets,
    ];
};

const runtimeAssets = (entrypoint: EntrypointAssetsMapEntry): EntrypointAssets => {
    return {initial: entrypoint.initial, async: entrypoint.async};
};

const findNamedFile = (files: readonly string[], name: string, extension: "css" | "js"): string => {
    const expression = new RegExp(`^custom/${extension}/${name}\\.${AppToken}\\.[a-f0-9]{8}\\.${extension}$`);
    const file = files.find(candidate => expression.test(candidate));

    if (!file) {
        throw new Error(`Could not find ${name}.${extension} in ${JSON.stringify(files)}`);
    }

    return file;
};

const normalizeUrl = (url: string): string => {
    return url
        .replace(/[?#].*$/, "")
        .replace(/^[a-z]+:\/\/[^/]+\//i, "")
        .replace(/^\/+/, "");
};

const executeEntrypoint = (build: BuildResult, name: keyof EntrypointAssetsMap): RuntimeResult => {
    const requested = {css: [] as string[], js: [] as string[]};
    const scripts: FakeElement[] = [];
    const links: FakeElement[] = [];
    let context: vm.Context;

    const remove = (collection: FakeElement[], element: FakeElement): void => {
        const index = collection.indexOf(element);

        if (index >= 0) {
            collection.splice(index, 1);
        }
    };
    let document: {
        createElement(tagName: string): FakeElement;
        getElementsByTagName(tagName: string): readonly (FakeElement | FakeHead)[];
        head: FakeHead;
    };
    const head: FakeHead = {
        appendChild: element => {
            element.parentNode = head;

            if (element.tagName === "SCRIPT") {
                const file = normalizeUrl(element.src ?? element.getAttribute("src") ?? "");
                const source = build.sources[file];

                requested.js.push(file);
                scripts.push(element);

                if (source) {
                    new vm.Script(source, {filename: file}).runInContext(context);
                    element.onload?.({target: element, type: "load"});
                } else {
                    element.onerror?.({target: element, type: "error"});
                }
            } else if (element.tagName === "LINK") {
                const file = normalizeUrl(element.href ?? element.getAttribute("href") ?? "");

                requested.css.push(file);
                links.push(element);

                if (build.sources[file]) {
                    element.onload?.({target: element, type: "load"});
                } else {
                    element.onerror?.({target: element, type: "error"});
                }
            }

            return element;
        },
        removeChild: element => {
            remove(scripts, element);
            remove(links, element);

            return element;
        },
    };
    const createElement = (tagName: string): FakeElement => {
        const attributes: Record<string, string> = {};
        const element = {
            tagName: tagName.toUpperCase(),
            getAttribute: (attribute: string) => {
                const value = (element as FakeElement & Record<string, unknown>)[attribute];

                return typeof value === "string" ? value : (attributes[attribute] ?? null);
            },
            setAttribute: (attribute: string, value: string) => {
                attributes[attribute] = value;
                (element as FakeElement & Record<string, unknown>)[attribute] = value;
            },
        } as FakeElement;

        return element;
    };

    document = {
        createElement,
        head,
        getElementsByTagName: tagName => {
            if (tagName.toLowerCase() === "script") return scripts;
            if (tagName.toLowerCase() === "link") return links;
            if (tagName.toLowerCase() === "head") return [head];

            return [];
        },
    };

    const sandbox: Record<string, unknown> = {clearTimeout, console, document, setTimeout};

    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    context = vm.createContext(sandbox);

    for (const file of build.assets[name].initial.js) {
        new vm.Script(build.sources[file], {filename: file}).runInContext(context);
    }

    return {requested, sandbox};
};

const expectCompleteMap = (build: BuildResult, commonChunks: boolean): void => {
    const {assets, sources: emittedSources} = build;

    expect(Object.keys(assets)).toEqual(["alpha", "background", "beta"]);

    const background = findNamedFile(assets.background.initial.js, "background", "js");
    const alpha = findNamedFile(assets.alpha.initial.js, "alpha", "js");
    const beta = findNamedFile(assets.beta.initial.js, "beta", "js");

    expect(assets.background.initial.js).toEqual([background]);
    expect(assets.background.async.js).toEqual([]);
    expect(assets.alpha.initial.js).toContain(alpha);
    expect(assets.beta.initial.js).toContain(beta);
    expect(assets.alpha.initial.js).not.toContain(background);
    expect(assets.beta.initial.js).not.toContain(background);

    if (commonChunks) {
        const common = findNamedFile(assets.alpha.initial.js, "common", "js");

        expect(assets.beta.initial.js).toContain(common);
    } else {
        expect([...assets.alpha.initial.js, ...assets.beta.initial.js]).not.toEqual(
            expect.arrayContaining([expect.stringContaining("/common.")])
        );
    }

    expect(assets.alpha.initial.css).toEqual([
        expect.stringMatching(/^custom\/css\/alpha\.build-assets-fixture\.[a-f0-9]{8}\.css$/),
    ]);
    expect(assets.beta.initial.css).toEqual([
        expect.stringMatching(/^custom\/css\/beta\.build-assets-fixture\.[a-f0-9]{8}\.css$/),
    ]);
    expect(assets.alpha.async.js).toEqual([
        expect.stringMatching(/^custom\/js\/alpha-lazy\.build-assets-fixture\.[a-f0-9]{8}\.js$/),
    ]);
    expect(assets.beta.async.js).toEqual([
        expect.stringMatching(/^custom\/js\/beta-lazy\.build-assets-fixture\.[a-f0-9]{8}\.js$/),
    ]);
    expect(assets.alpha.async.css).toEqual([
        expect.stringMatching(/^custom\/css\/alpha-lazy\.build-assets-fixture\.[a-f0-9]{8}\.css$/),
    ]);
    expect(assets.beta.async.css).toEqual([
        expect.stringMatching(/^custom\/css\/beta-lazy\.build-assets-fixture\.[a-f0-9]{8}\.css$/),
    ]);
    expect(assets.alpha.assets).toEqual([
        expect.stringMatching(/^custom\/assets\/font\.build-assets-fixture\.[a-f0-9]{8}\.woff2$/),
        expect.stringMatching(/^custom\/assets\/lazy-image\.build-assets-fixture\.[a-f0-9]{8}\.svg$/),
        expect.stringMatching(/^custom\/assets\/payload\.build-assets-fixture\.[a-f0-9]{8}\.js$/),
    ]);
    expect(assets.background.assets).toEqual([]);
    expect(assets.beta.assets).toEqual([]);

    const codeFiles = Object.values(assets).flatMap(entrypoint => [...entrypoint.initial.js, ...entrypoint.async.js]);
    const payload = assets.alpha.assets.find(file => file.endsWith(".js"));

    expect(payload).toBeDefined();
    expect(codeFiles).not.toContain(payload);

    for (const entrypoint of Object.values(assets)) {
        const initial = new Set([...entrypoint.initial.js, ...entrypoint.initial.css]);
        const async = [...entrypoint.async.js, ...entrypoint.async.css];

        expect(async.filter(file => initial.has(file))).toEqual([]);
        expect(flattenEntrypoint(entrypoint).filter(file => file.endsWith(".map"))).toEqual([]);
    }

    const mappedFiles = new Set(Object.values(assets).flatMap(flattenEntrypoint));
    const emittedFiles = Object.keys(emittedSources).filter(file => !file.endsWith(".map"));

    expect(emittedFiles.toSorted()).toEqual([...mappedFiles, UnrelatedFile].toSorted());
    expect(emittedFiles.filter(file => file.endsWith(".json"))).toEqual([]);
    expect(mappedFiles.has(UnrelatedFile)).toBe(false);
    const emittedCode = Object.entries(emittedSources)
        .filter(([file]) => !file.endsWith(".map"))
        .map(([, source]) => source);

    expect(emittedCode.every(source => !source.includes(FullMapPlaceholder))).toBe(true);
    expect(emittedCode.every(source => !source.includes("scheduleEntrypoint"))).toBe(true);
    expect(emittedCode.every(source => !source.includes("__adnbnScheduleEntrypoint"))).toBe(true);
};

const expectNoChangedBytesUnderStableNames = (before: BuildResult, after: BuildResult): void => {
    for (const file of Object.keys(before.hashes)) {
        if (Object.hasOwn(after.hashes, file)) {
            expect(after.hashes[file]).toBe(before.hashes[file]);
        }
    }
};

jest.setTimeout(120_000);

describe("BuildAssetsMapPlugin Plan A", () => {
    test.each(["chunkhash", "contenthash", "fullhash"] as const)(
        "exposes isolated runtime maps with %s filenames",
        async jsHash => {
            const build = await compile(true, {jsHash});

            expectCompleteMap(build, true);

            const background = executeEntrypoint(build, "background").sandbox;
            const alpha = executeEntrypoint(build, "alpha").sandbox;
            const beta = executeEntrypoint(build, "beta").sandbox;

            const backgroundTrace = background.__buildAssetsGetterTrace as BuildAssetsGetterTrace;
            const alphaTrace = alpha.__buildAssetsGetterTrace as BuildAssetsGetterTrace;
            const betaTrace = beta.__buildAssetsGetterTrace as BuildAssetsGetterTrace;

            expect(background.__backgroundBuildAssets).toEqual(build.assets);
            expect(alpha.__alphaEntrypointAssets).toEqual(runtimeAssets(build.assets.alpha));
            expect(beta.__betaEntrypointAssets).toEqual(runtimeAssets(build.assets.beta));
            expect(backgroundTrace).toEqual({
                current: {error: "Current entrypoint assets are unavailable in this runtime", ok: false},
                full: {ok: true, value: build.assets},
            });
            expect(alphaTrace).toEqual({
                current: {ok: true, value: runtimeAssets(build.assets.alpha)},
                full: {error: "getEntrypointAssetsMap() is available only in the background entrypoint", ok: false},
            });
            expect(betaTrace).toEqual({
                current: {ok: true, value: runtimeAssets(build.assets.beta)},
                full: {error: "getEntrypointAssetsMap() is available only in the background entrypoint", ok: false},
            });
            expect(alpha.__buildAssetsPayloadExecuted).toBeUndefined();
        }
    );

    test("preserves lazy JS and CSS loading inside a local runtime", async () => {
        const build = await compile(true);
        const {requested, sandbox} = executeEntrypoint(build, "alpha");
        const load = sandbox.loadAlphaFixture;

        expect(typeof load).toBe("function");

        const module = await (load as () => Promise<{alphaLazy: boolean}>)();

        expect(module.alphaLazy).toBe(true);
        expect(requested.js).toEqual(build.assets.alpha.async.js);
        expect(requested.css).toEqual(build.assets.alpha.async.css);
    });

    test("does not append background files to generated HTML", async () => {
        const build = await compile(false, {htmlChunks: ["alpha", "beta"]});
        const html = build.sources["fixture.html"];
        const scripts = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g), match => match[1]);
        const background = findNamedFile(build.assets.background.initial.js, "background", "js");

        expect(scripts.map(normalizeUrl)).not.toContain(background);
        expect(scripts.every(script => !script.includes("__adnbn_build_assets__"))).toBe(true);
    });

    test("rejects async chunks in the background entrypoint", async () => {
        await expect(compile(false, {background: "async"})).rejects.toThrow(
            'Full build-assets entrypoint "background" must be a single self-contained chunk; async chunks are not supported'
        );
    });

    test("rejects a shared initial chunk extracted from background", async () => {
        await expect(compile(true, {background: "shared"})).rejects.toThrow(
            'Full build-assets entrypoint "background" must be a single self-contained chunk; async chunks are not supported'
        );
    });

    test("rejects separate runtime chunks after user optimization is applied", async () => {
        await expect(compile(false, {separateRuntime: true})).rejects.toThrow(
            'Build assets require a self-contained runtime for entrypoint "background"; disable optimization.runtimeChunk'
        );
    });

    test("rejects the Rspack fullhash callback limitation before emitting invalid JavaScript", async () => {
        await expect(compile(false, {fullHashCallback: true, jsHash: "fullhash"})).rejects.toThrow(
            "Rspack cannot generate async chunk URLs when a filename callback returns [fullhash]; configure jsFilename as a string template instead"
        );
    });

    test("rejects the Rspack CSS fullhash callback limitation before emitting invalid JavaScript", async () => {
        await expect(compile(false, {cssFullHashCallback: true})).rejects.toThrow(
            "Rspack cannot generate async CSS chunk URLs when a filename callback returns [fullhash]; configure cssFilename as a string template instead"
        );
    });

    test("uses Rspack PathData and AssetInfo when resolving a local callback map", async () => {
        const build = await compile(false, {assetInfoFilename: true, jsHash: "contenthash"});
        const alpha = executeEntrypoint(build, "alpha").sandbox;

        expect(build.assets.alpha.initial.js[0]).toMatch(/^custom\/js\/javascript\/alpha\./);
        expect(alpha.__alphaEntrypointAssets).toEqual(runtimeAssets(build.assets.alpha));
    });

    test("hashes callback results that depend on opaque closure values", async () => {
        const [before, after] = await Promise.all([
            compile(false, {betaDirectory: "beta-a", buildHashSalt: "opaque-callback"}),
            compile(false, {betaDirectory: "beta-b", buildHashSalt: "opaque-callback"}),
        ]);
        const backgroundBefore = findNamedFile(before.assets.background.initial.js, "background", "js");
        const backgroundAfter = findNamedFile(after.assets.background.initial.js, "background", "js");

        expect(after.assets.beta.initial.js).not.toEqual(before.assets.beta.initial.js);
        expect(backgroundAfter).not.toBe(backgroundBefore);
        expectNoChangedBytesUnderStableNames(before, after);
    });

    test("invalidates the background map when a foreign runtime module changes another entrypoint", async () => {
        const [before, after] = await Promise.all([
            compile(false, {betaRuntimeMarker: "before", buildHashSalt: "foreign-runtime"}),
            compile(false, {betaRuntimeMarker: "after", buildHashSalt: "foreign-runtime"}),
        ]);
        const backgroundBefore = findNamedFile(before.assets.background.initial.js, "background", "js");
        const backgroundAfter = findNamedFile(after.assets.background.initial.js, "background", "js");
        const betaBefore = findNamedFile(before.assets.beta.initial.js, "beta", "js");
        const betaAfter = findNamedFile(after.assets.beta.initial.js, "beta", "js");

        expect(betaAfter).not.toBe(betaBefore);
        expect(after.hashes[betaAfter]).not.toBe(before.hashes[betaBefore]);
        expect(backgroundAfter).not.toBe(backgroundBefore);
        expectNoChangedBytesUnderStableNames(before, after);
        expect(executeEntrypoint(after, "background").sandbox.__backgroundBuildAssets).toEqual(after.assets);
    });

    test("rejects callbacks that read unresolved hash data instead of returning placeholders", async () => {
        await expect(compile(false, {resolvedHashFilename: true})).rejects.toThrow(
            "Build assets filename callbacks cannot read PathData hash values; return [contenthash], [chunkhash], or [fullhash] placeholders instead"
        );
    });

    test("keeps custom hashed filenames and bytes stable across identical builds", async () => {
        const [first, second] = await Promise.all([compile(false), compile(false)]);

        expect(second.assets).toEqual(first.assets);
        expect(second.hashes).toEqual(first.hashes);
    });

    test.each(["chunkhash", "contenthash"] as const)(
        "invalidates %s maps when a foreign CSS dependency changes",
        async jsHash => {
            const [before, after] = await Promise.all([
                compile(false, {jsHash}),
                compile(false, {betaCssChange: true, jsHash}),
            ]);
            const backgroundBefore = findNamedFile(before.assets.background.initial.js, "background", "js");
            const backgroundAfter = findNamedFile(after.assets.background.initial.js, "background", "js");
            const betaBefore = findNamedFile(before.assets.beta.initial.js, "beta", "js");
            const betaAfter = findNamedFile(after.assets.beta.initial.js, "beta", "js");

            expect(backgroundAfter).not.toBe(backgroundBefore);
            expect(betaAfter).not.toBe(betaBefore);
            expect(after.assets.beta.initial.css).not.toEqual(before.assets.beta.initial.css);
            expectNoChangedBytesUnderStableNames(before, after);
            expect(executeEntrypoint(after, "background").sandbox.__backgroundBuildAssets).toEqual(after.assets);
            expect(executeEntrypoint(after, "beta").sandbox.__betaEntrypointAssets).toEqual(
                runtimeAssets(after.assets.beta)
            );
        }
    );

    test("invalidates every consumer when a shared chunk changes", async () => {
        const [before, after] = await Promise.all([compile(true), compile(true, {sharedChange: true})]);

        for (const name of ["alpha", "background", "beta"] as const) {
            expect(findNamedFile(after.assets[name].initial.js, name, "js")).not.toBe(
                findNamedFile(before.assets[name].initial.js, name, "js")
            );
        }

        expectNoChangedBytesUnderStableNames(before, after);
    });

    test("does not invent a JavaScript file for a CSS-only shared chunk", async () => {
        const build = await compile(true, {sharedCssChunk: true});
        const sharedCss = build.assets.alpha.initial.css.find(file => build.assets.beta.initial.css.includes(file));

        expect(sharedCss).toMatch(/^custom\/css\/shared-styles\..+\.css$/);
        expect(build.assets.alpha.initial.js.some(file => file.includes("shared-styles"))).toBe(false);
        expect(build.assets.beta.initial.js.some(file => file.includes("shared-styles"))).toBe(false);
        expect(executeEntrypoint(build, "alpha").sandbox.__alphaEntrypointAssets).toEqual(
            runtimeAssets(build.assets.alpha)
        );
        expect(executeEntrypoint(build, "beta").sandbox.__betaEntrypointAssets).toEqual(
            runtimeAssets(build.assets.beta)
        );
    });

    test("keeps configured CSS directories inside callback-generated names", async () => {
        const [css, styles] = await Promise.all([
            compile(false, {buildHashSalt: "css-directory", cssDir: "custom/css"}),
            compile(false, {buildHashSalt: "styles-directory", cssDir: "custom/styles"}),
        ]);

        expect(css.assets.beta.initial.css[0]).toMatch(/^custom\/css\//);
        expect(styles.assets.beta.initial.css[0]).toMatch(/^custom\/styles\//);
        expect(findNamedFile(styles.assets.background.initial.js, "background", "js")).not.toBe(
            findNamedFile(css.assets.background.initial.js, "background", "js")
        );
    });

    test.each([
        {options: {renameBetaCss: true}, scenario: "renamed during processAssets"},
        {options: {removeBetaCss: true}, scenario: "removed during processAssets"},
        {options: {renameBetaCssAfterProcessAssets: true}, scenario: "renamed after processAssets"},
        {
            options: {assertEmptyOutputOnFailure: true, renameBetaCssAtEmit: true},
            scenario: "renamed at emit",
        },
    ])("rejects an asset $scenario", async ({options}) => {
        await expect(compile(false, options)).rejects.toThrow(
            "Build assets changed after the runtime map was embedded"
        );
    });

    test("rejects a late asset rename when the build has no background entrypoint", async () => {
        await expect(
            compile(false, {
                includeBackground: false,
                renameBetaCssAfterProcessAssets: true,
            })
        ).rejects.toThrow('Build assets changed after the runtime map for entrypoint "beta" was embedded');
    });
});
