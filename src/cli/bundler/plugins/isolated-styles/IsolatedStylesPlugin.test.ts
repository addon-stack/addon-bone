/** @jest-environment node */

import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";

import {type Compiler, CssExtractRspackPlugin, type Filename, rspack, type Stats} from "@rspack/core";

import {IsolatedStylesLayer} from "@cli/bundler/utils/styles";

import IsolatedStylesPlugin, {
    type IsolatedStylesPluginOptions,
    type IsolatedStylesPluginFiles,
} from "./IsolatedStylesPlugin";

const fixtures = path.resolve(__dirname, "tests", "fixtures");
const projectRoot = path.resolve(__dirname, "../../../../..");
const RuntimeProperty = "fixtureStyles";

interface BuildResult {
    readonly property: string;
    readonly close: () => Promise<void>;
    readonly compiler: Compiler;
    readonly outputPath: string;
    readonly stats: Stats;
}

interface FakeLink {
    href: string;
    onerror: ((event: {type: string}) => void) | null;
    onload: (() => void) | null;
    rel: string;
    type: string;
    remove(): void;
}

interface FakeRoot {
    ownerDocument: {createElement(tag: string): FakeLink};
    readonly links: FakeLink[];
    insertBefore(link: FakeLink, container: object): FakeLink;
}

interface RuntimeApi {
    initialize(resolveUrl: (file: string) => string): void;
    add(root: FakeRoot, target: object, retry?: boolean): void;
    delete(root: FakeRoot): void;
    load(url: string): Promise<void>;
}

interface RuntimeHarness {
    readonly requestedScripts: string[];
    readonly runtime: RuntimeApi;
    readonly sandbox: Record<string, unknown>;
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

interface CompileOptions {
    validate?: IsolatedStylesPluginOptions["validate"];
    ignoreWarnings?: RegExp[];
    property?: string;
    shadowEntry?: string;
    context?: string;
    filename?: Filename;
    cssFilename?: Filename;
    sharedInitial?: boolean;
    mode?: "development" | "production";
    selected?: (entry: string) => boolean;
    timeout?: number;
}

const createCompiler = (outputPath: string, options: CompileOptions = {}): Compiler => {
    const filename = options.filename ?? "js/[name].[contenthash:8].js";

    const cssFilename = options.cssFilename ?? "css/[name].[contenthash:8].css";

    return rspack({
        context: options.context ?? fixtures,
        mode: options.mode ?? "development",
        target: ["web", "es2020"],
        devtool: false,
        ignoreWarnings: options.ignoreWarnings,
        entry: {
            shadow: options.shadowEntry ?? (options.sharedInitial ? "./shadow-shared.js" : "./shadow.js"),
            normal: options.sharedInitial ? "./normal-shared.js" : "./normal.js",
        },
        output: {
            path: outputPath,
            clean: true,
            filename,
            chunkFilename: filename,
            publicPath: "https://extension.test/",
            globalObject: "globalThis",
            uniqueName: "isolatedStylesFixture",
        },
        resolveLoader: {
            modules: [path.resolve(projectRoot, "node_modules"), "node_modules"],
        },
        module: {
            rules: [
                {test: /shadow.*\.css$/, layer: IsolatedStylesLayer},
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
            minimize: false,
            runtimeChunk: false,
            splitChunks: options.sharedInitial
                ? {
                      cacheGroups: {
                          sharedStyles: {
                              type: "css/mini-extract",
                              name: "shared-styles",
                              chunks: "all",
                              minChunks: 2,
                              enforce: true,
                          },
                      },
                  }
                : false,
        },
        plugins: [
            new CssExtractRspackPlugin({
                filename: cssFilename,
                chunkFilename: cssFilename,
            }),
            new IsolatedStylesPlugin({
                cssFilename,
                cssChunkFilename: cssFilename,
                property: options.property ?? RuntimeProperty,
                validate: options.validate,
                test: options.selected ?? (entry => entry === "shadow"),
                timeout: options.timeout ?? 1_000,
            }),
        ],
    });
};

const compile = async (options: CompileOptions = {}): Promise<BuildResult> => {
    const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-isolated-styles-"));
    const compiler = createCompiler(outputPath, options);

    try {
        const stats = await runCompiler(compiler);

        return {
            property: options.property ?? RuntimeProperty,
            close: async () => {
                await closeCompiler(compiler);
                fs.rmSync(outputPath, {force: true, recursive: true});
            },
            compiler,
            outputPath,
            stats,
        };
    } catch (error) {
        await closeCompiler(compiler);
        fs.rmSync(outputPath, {force: true, recursive: true});
        throw error;
    }
};

test.each(["./shadow.js", "./shadow-async.js"])(
    "reports initial and async CSS independently of runtime selection (%s)",
    async shadowEntry => {
        const validated = new Map<string, IsolatedStylesPluginFiles>();
        const result = await compile({
            shadowEntry,
            selected: () => false,
            validate: (entry, files) => {
                validated.set(entry, files);
            },
        });
        await result.close();
        expect([...validated.keys()].sort()).toEqual(["normal", "shadow"]);
        expect(validated.get("normal")!.isolated).toEqual([]);
        expect(validated.get("normal")!.document).toEqual([
            expect.stringMatching(/normal-lazy\./),
            expect.stringMatching(/normal\./),
        ]);
        expect(validated.get("shadow")!.document).toEqual([]);
        expect(validated.get("shadow")!.isolated).toHaveLength(shadowEntry === "./shadow.js" ? 2 : 1);

        await expect(
            compile({
                shadowEntry,
                selected: () => false,
                validate: (entry, files) => {
                    if (files.isolated.length) throw new Error(`Consumer policy rejects styles for "${entry}"`);
                },
            })
        ).rejects.toThrow('Consumer policy rejects styles for "shadow"');
    }
);

test("reports shared styles to both entries without duplicate filenames", async () => {
    const validated = new Map<string, IsolatedStylesPluginFiles>();
    const result = await compile({
        sharedInitial: true,
        validate: (entry, files) => {
            validated.set(entry, files);
        },
    });
    try {
        const shared = validated.get("shadow")!.isolated.find(file => /shared-styles\./.test(file));
        expect(shared).toBeDefined();
        expect(validated.get("normal")!.isolated).toEqual([shared]);
        expect(validated.get("shadow")!.isolated).toHaveLength(2);
    } finally {
        await result.close();
    }
});

test("refreshes warnings between compilations and supports the bundler warning filter", async () => {
    let warn = true;
    const message = '[fixture:missing-isolation-css] Entrypoint "shadow"';
    const validate: IsolatedStylesPluginOptions["validate"] = (entry, files) =>
        warn && entry === "shadow" && files.document.length > 0 && files.isolated.length === 0 ? [message] : [];
    const result = await compile({shadowEntry: "./normal.js", validate});
    try {
        expect(result.stats.compilation.warnings.map(warning => warning.message)).toEqual([
            expect.stringContaining(message),
        ]);
        const filenames = result.stats.compilation
            .getAssets()
            .map(asset => asset.name)
            .sort();
        warn = false;
        const rebuilt = await runCompiler(result.compiler);
        expect(rebuilt.compilation.warnings).toHaveLength(0);
        expect(
            rebuilt.compilation
                .getAssets()
                .map(asset => asset.name)
                .sort()
        ).toEqual(filenames);
        warn = true;
        const repeated = await runCompiler(result.compiler);
        expect(repeated.compilation.warnings.map(warning => warning.message)).toEqual([
            expect.stringContaining(message),
        ]);
    } finally {
        await result.close();
    }
    const suppressed = await compile({
        shadowEntry: "./normal.js",
        validate,
        ignoreWarnings: [/fixture:missing-isolation-css/],
    });
    try {
        expect(suppressed.stats.toJson({all: false, warnings: true}).warnings).toEqual([]);
    } finally {
        await suppressed.close();
    }
});

const entryFile = (stats: Stats, entry: string, extension: ".css" | ".js"): string => {
    const file = stats.compilation.entrypoints
        .get(entry)
        ?.getFiles()
        .find(candidate => candidate.endsWith(extension));

    if (!file) {
        throw new Error(`${extension} file for entrypoint ${entry} was not found`);
    }

    return file;
};

const source = (stats: Stats, file: string): string => {
    const asset = stats.compilation.getAsset(file);

    if (!asset) {
        throw new Error(`Asset ${file} was not found`);
    }

    return asset.source.source().toString();
};

const createRoot = (onInsert: (link: FakeLink) => void): FakeRoot => {
    const links: FakeLink[] = [];

    return {
        ownerDocument: {createElement: () => ({href: "", rel: "", type: "", onload: null, onerror: null, remove() {}})},
        links,
        insertBefore(link, target) {
            const position = links.indexOf(target as FakeLink);
            if (position < 0) links.push(link);
            else links.splice(position, 0, link);
            link.remove = () => {
                const index = links.indexOf(link);

                if (index >= 0) links.splice(index, 1);
            };
            onInsert(link);

            return link;
        },
    };
};

const executeShadowEntrypoint = (result: BuildResult): RuntimeHarness => {
    const requestedScripts: string[] = [];
    let context: vm.Context;
    const sandbox: Record<string, any> = {
        clearTimeout,
        console,
        Promise,
        setTimeout,
    };

    const element = (tagName: string): Record<string, any> => {
        const attributes = new Map<string, string>();

        return {
            tagName: tagName.toUpperCase(),
            getAttribute: (name: string) => attributes.get(name) ?? null,
            setAttribute: (name: string, value: string) => attributes.set(name, value),
        };
    };

    const head = {
        appendChild(node: Record<string, any>) {
            node.parentNode = head;

            if (node.tagName === "SCRIPT") {
                const url = String(node.src);
                const filename = url.replace("https://extension.test/", "");
                requestedScripts.push(filename);
                vm.runInContext(fs.readFileSync(path.join(result.outputPath, filename), "utf8"), context);
                queueMicrotask(() => node.onload?.({target: node, type: "load"}));
            } else {
                queueMicrotask(() => node.onload?.({target: node, type: "load"}));
            }

            return node;
        },
        removeChild(node: Record<string, any>) {
            node.parentNode = undefined;

            return node;
        },
    };

    sandbox.document = {
        createElement: element,
        getElementsByTagName: () => [],
        head,
    };
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    context = vm.createContext(sandbox);

    vm.runInContext(source(result.stats, entryFile(result.stats, "shadow", ".js")), context);

    const getRuntime = sandbox.getStylesRuntime as ((property: string) => RuntimeApi) | undefined;

    if (!getRuntime) {
        throw new Error("Shadow fixture did not expose the style runtime");
    }

    const runtime = getRuntime(result.property);
    runtime.initialize(file => `https://extension.test/${file}`);
    return {requestedScripts, runtime, sandbox};
};

test("replaces the CSS loading runtime only for selected entrypoints", async () => {
    const result = await compile();

    try {
        const shadow = source(result.stats, entryFile(result.stats, "shadow", ".js"));
        const normal = source(result.stats, entryFile(result.stats, "normal", ".js"));

        expect(shadow).toContain(RuntimeProperty);
        expect(shadow).toContain("isolatedStyleRoots");
        expect(shadow).toContain("loadDocumentStylesheet");
        expect(normal).not.toContain(RuntimeProperty);
        expect(normal).toContain("document.head.appendChild(linkTag)");
    } finally {
        await result.close();
    }
});

test("uses a literal custom property for both the style registry and async CSS loader", async () => {
    const result = await compile({property: 'styles.$&__ADNBN_REQUIRE__"\\\n'});
    try {
        const harness = executeShadowEntrypoint(result);
        const root = createRoot(link => queueMicrotask(() => link.onload?.()));
        harness.runtime.add(root, {});
        await (harness.sandbox.loadIsolatedStyles as () => Promise<unknown>)();
        expect(root.links.length).toBeGreaterThan(0);
        harness.runtime.delete(root);
    } finally {
        await result.close();
    }
});

test("loads initial and async CSS into every active root and keeps requested styles for late roots", async () => {
    const result = await compile();

    try {
        const harness = executeShadowEntrypoint(result);
        const initialUrl = `https://extension.test/${entryFile(result.stats, "shadow", ".css")}`;
        const inserted: string[] = [];
        const rootA = createRoot(link => {
            inserted.push(`a:${link.href}`);
            queueMicrotask(() => link.onload?.());
        });
        const rootB = createRoot(link => {
            inserted.push(`b:${link.href}`);
            queueMicrotask(() => link.onload?.());
        });

        harness.runtime.add(rootA, {});
        harness.runtime.add(rootB, {});
        await (harness.sandbox.loadIsolatedStyles as () => Promise<unknown>)();

        const lazyCss = result.stats.compilation
            .getAssets()
            .map(asset => asset.name)
            .find(file => file.includes("shadow-lazy") && file.endsWith(".css"));

        expect(lazyCss).toBeDefined();
        expect(inserted).toEqual(
            expect.arrayContaining([
                `a:${initialUrl}`,
                `b:${initialUrl}`,
                `a:https://extension.test/${lazyCss}`,
                `b:https://extension.test/${lazyCss}`,
            ])
        );
        expect(rootA.links).toHaveLength(2);
        expect(rootB.links).toHaveLength(2);

        const lateRoot = createRoot(link => queueMicrotask(() => link.onload?.()));
        harness.runtime.add(lateRoot, {});
        await Promise.resolve();
        await Promise.resolve();

        expect(lateRoot.links.map(link => link.href)).toEqual([initialUrl, `https://extension.test/${lazyCss}`]);
        expect(harness.requestedScripts).toEqual([expect.stringMatching(/shadow-lazy.*\.js$/)]);
    } finally {
        await result.close();
    }
});

test("does not wait for a future root when import happens before rendering", async () => {
    const result = await compile();

    try {
        const harness = executeShadowEntrypoint(result);

        await expect((harness.sandbox.loadIsolatedStyles as () => Promise<unknown>)()).resolves.toMatchObject({
            shadowLazy: true,
        });

        const root = createRoot(link => queueMicrotask(() => link.onload?.()));
        harness.runtime.add(root, {});
        await Promise.resolve();
        await Promise.resolve();

        expect(root.links).toHaveLength(2);
        expect(root.links[0].href).toBe(`https://extension.test/${entryFile(result.stats, "shadow", ".css")}`);
        expect(root.links[1].href).toContain("shadow-lazy");
    } finally {
        await result.close();
    }
});

test("reports an initial stylesheet failure without removing the root and permits retry", async () => {
    const result = await compile();
    const report = jest.spyOn(console, "error").mockImplementation(() => {});

    try {
        const harness = executeShadowEntrypoint(result);
        const initialUrl = `https://extension.test/${entryFile(result.stats, "shadow", ".css")}`;
        let attempt = 0;
        const root = createRoot(link => {
            attempt += 1;
            queueMicrotask(() => {
                if (attempt === 1) {
                    link.onerror?.({type: "error"});
                } else {
                    link.onload?.();
                }
            });
        });

        harness.runtime.add(root, {});
        await new Promise<void>(resolve => setImmediate(resolve));

        expect(report).toHaveBeenCalledWith(
            expect.objectContaining({
                code: "CSS_CHUNK_LOAD_FAILED",
                request: initialUrl,
                type: "error",
            })
        );
        expect(root.links).toHaveLength(0);

        await expect(harness.runtime.load(initialUrl)).resolves.toBeUndefined();
        expect(root.links.map(link => link.href)).toEqual([initialUrl]);
    } finally {
        report.mockRestore();
        await result.close();
    }
});

test("retries restored styles once in cascade order, sharing the pending promise but not retrying future imports", async () => {
    const result = await compile({sharedInitial: true});
    const report = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
        const {runtime} = executeShadowEntrypoint(result);
        const remembered = "https://extension.test/css/remembered.css";
        await runtime.load(remembered);
        const inserted: FakeLink[] = [];
        const root = createRoot(link => inserted.push(link));
        runtime.add(root, {}, true);
        const original = [...root.links];
        expect(original).toHaveLength(3);
        const pending = Promise.all(original.map(link => runtime.load(link.href)));
        let resolved = false;
        void pending.then(
            () => {
                resolved = true;
            },
            () => {}
        );
        for (const link of original) link.onerror?.({type: "error"});
        expect(inserted).toHaveLength(6);
        expect(root.links.map(link => link.href)).toEqual(original.map(link => link.href));
        expect(root.links.every(link => !original.includes(link))).toBe(true);
        await Promise.resolve();
        expect(resolved).toBe(false);
        for (const link of root.links) link.onload?.();
        await pending;
        expect(report).not.toHaveBeenCalled();

        const future = runtime.load("https://extension.test/css/future.css");
        const failure = expect(future).rejects.toMatchObject({type: "error"});
        root.links.at(-1)!.onerror?.({type: "error"});
        await failure;
        expect(inserted).toHaveLength(7);
        runtime.delete(root);
    } finally {
        report.mockRestore();
        await result.close();
    }
});

test("reports a second recovery failure and does not resurrect links through stale callbacks", async () => {
    const result = await compile();
    const report = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
        const {runtime} = executeShadowEntrypoint(result);
        const root = createRoot(() => {});
        runtime.add(root, {}, true);
        const first = root.links[0];
        const staleError = first.onerror!;
        const pending = runtime.load(first.href);
        const failure = expect(pending).rejects.toMatchObject({
            code: "CSS_CHUNK_LOAD_FAILED",
            type: "error",
            request: first.href,
        });
        first.onerror?.({type: "error"});
        const retry = root.links[0];
        expect(retry).not.toBe(first);
        staleError({type: "error"});
        expect(root.links).toEqual([retry]);
        retry.onerror?.({type: "error"});
        await failure;
        expect(root.links).toHaveLength(0);
        expect(report).toHaveBeenCalledTimes(1);
        expect(report).toHaveBeenCalledWith(expect.objectContaining({message: expect.stringContaining("shadow")}));
        staleError({type: "error"});
        expect(root.links).toHaveLength(0);
        runtime.delete(root);
    } finally {
        report.mockRestore();
        await result.close();
    }
});

test("keeps one timeout budget across recovery attempts and cancels work when a root is removed", async () => {
    const result = await compile({timeout: 100});
    const report = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.useFakeTimers();
    try {
        const {runtime} = executeShadowEntrypoint(result);
        const inserted: FakeLink[] = [];
        const root = createRoot(link => inserted.push(link));
        runtime.add(root, {}, true);
        const initial = root.links[0];
        const pending = runtime.load(initial.href);
        const failure = expect(pending).rejects.toMatchObject({type: "timeout", request: initial.href});
        jest.advanceTimersByTime(75);
        initial.onerror?.({type: "error"});
        expect(root.links[0]).not.toBe(initial);
        jest.advanceTimersByTime(25);
        await failure;
        expect(root.links).toHaveLength(0);
        expect(inserted).toHaveLength(2);
        expect(jest.getTimerCount()).toBe(0);
        runtime.delete(root);

        // A timeout is final even when recovery permits a retry on a load error.
        const stalledLinks: FakeLink[] = [];
        const stalled = createRoot(link => stalledLinks.push(link));
        runtime.add(stalled, {}, true);
        const timedOut = expect(runtime.load(stalled.links[0].href)).rejects.toMatchObject({type: "timeout"});
        jest.advanceTimersByTime(100);
        await timedOut;
        expect(stalledLinks).toHaveLength(1);
        expect(stalled.links).toHaveLength(0);
        runtime.delete(stalled);

        report.mockClear();
        for (const afterRetry of [false, true]) {
            const removed = createRoot(() => {});
            runtime.add(removed, {}, true);
            const waiting = runtime.load(removed.links[0].href);
            if (afterRetry) removed.links[0].onerror?.({type: "error"});
            const lastLink = removed.links[0];
            const lateError = lastLink.onerror!;
            runtime.delete(removed);
            lateError({type: "error"});
            await waiting;
            expect(removed.links).toHaveLength(0);
            expect(lastLink.onerror).toBeNull();
            expect(jest.getTimerCount()).toBe(0);
        }
        expect(report).not.toHaveBeenCalled();
    } finally {
        jest.useRealTimers();
        report.mockRestore();
        await result.close();
    }
});

test("rejects failed and timed out styles, removes failed links and permits retry", async () => {
    const result = await compile({timeout: 20, shadowEntry: "./shadow-async.js"});

    try {
        const harness = executeShadowEntrypoint(result);
        let attempt = 0;
        const root = createRoot(link => {
            attempt += 1;

            if (attempt === 1) queueMicrotask(() => link.onerror?.({type: "error"}));
            if (attempt === 2) queueMicrotask(() => link.onload?.());
        });
        harness.runtime.add(root, {});

        await expect((harness.sandbox.loadIsolatedStyles as () => Promise<unknown>)()).rejects.toThrow(
            /shadow[\s\S]*https:\/\/extension\.test\/css\/shadow-lazy/i
        );
        expect(root.links).toHaveLength(0);
        await expect((harness.sandbox.loadIsolatedStyles as () => Promise<unknown>)()).resolves.toMatchObject({
            shadowLazy: true,
        });

        harness.runtime.delete(root);
        const timedOut = createRoot(link => {
            if (!link.href.endsWith("/hanging.css")) queueMicrotask(() => link.onload?.());
        });
        harness.runtime.add(timedOut, {});

        await expect(harness.runtime.load("https://extension.test/css/hanging.css")).rejects.toMatchObject({
            type: "timeout",
            request: "https://extension.test/css/hanging.css",
        });
        expect(timedOut.links.map(link => link.href)).not.toContain("https://extension.test/css/hanging.css");
    } finally {
        await result.close();
    }
});

test("settles pending work when a root is removed and does not duplicate successful links", async () => {
    const result = await compile({shadowEntry: "./shadow-async.js"});

    try {
        const harness = executeShadowEntrypoint(result);
        const root = createRoot(() => undefined);
        harness.runtime.add(root, {});
        const pending = harness.runtime.load("https://extension.test/css/pending.css");

        harness.runtime.delete(root);

        await expect(pending).resolves.toBeUndefined();
        await harness.runtime.load("https://extension.test/css/pending.css");
        expect(root.links).toHaveLength(0);
        harness.runtime.add(root, {});
        expect(root.links).toHaveLength(1);
        root.links[0].onload?.();
        await harness.runtime.load("https://extension.test/css/pending.css");
        expect(root.links).toHaveLength(1);
    } finally {
        await result.close();
    }
});

test.each(["contenthash", "chunkhash", "fullhash"])(
    "resolves initial CSS with user %s filenames without the asset map plugin",
    async hash => {
        const result = await compile({
            filename: `js/[name].[${hash}:8].js`,
            cssFilename: `css/[name].[${hash}:8].css`,
            mode: "production",
        });

        try {
            expect(entryFile(result.stats, "shadow", ".js")).toMatch(/^js\/shadow\.[a-f0-9]{8}\.js$/);
            expect(source(result.stats, entryFile(result.stats, "shadow", ".js"))).toContain(RuntimeProperty);
            const harness = executeShadowEntrypoint(result);
            const root = createRoot(link => queueMicrotask(() => link.onload?.()));
            harness.runtime.add(root, {});
            expect(root.links.map(link => link.href)).toEqual([
                `https://extension.test/${entryFile(result.stats, "shadow", ".css")}`,
            ]);
            harness.runtime.delete(root);
        } finally {
            await result.close();
        }
    }
);

test("owns multiple initial files in bundler order, including a shared CSS chunk, and initializes once", async () => {
    const result = await compile({sharedInitial: true});
    try {
        const harness = executeShadowEntrypoint(result);
        const resolveAgain = jest.fn();
        harness.runtime.initialize(resolveAgain);
        expect(resolveAgain).not.toHaveBeenCalled();
        const root = createRoot(link => queueMicrotask(() => link.onload?.()));
        harness.runtime.add(root, {});
        const initial = result.stats.compilation.entrypoints
            .get("shadow")!
            .getFiles()
            .filter(file => file.endsWith(".css"));
        expect(initial).toHaveLength(2);
        expect(root.links.map(link => link.href)).toEqual(initial.map(file => `https://extension.test/${file}`));
        const normal = result.stats.compilation.entrypoints.get("normal")!.getFiles();
        expect(initial.some(file => normal.includes(file))).toBe(true);
        harness.runtime.delete(root);
    } finally {
        await result.close();
    }
});

test.each(["contenthash", "chunkhash", "fullhash", "callback"])(
    "refreshes initial CSS URLs after editing CSS across %s rebuilds",
    async hash => {
        const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-initial-styles-"));
        const context = path.join(temporaryRoot, "src");
        const outputPath = path.join(temporaryRoot, "dist");
        fs.cpSync(fixtures, context, {recursive: true});
        const cssFilename: Filename =
            hash === "callback" ? () => "custom/[name].[contenthash:8].css" : `css/[name].[${hash}:8].css`;
        const compiler = createCompiler(outputPath, {context, cssFilename, mode: "production"});
        try {
            const filenames: string[] = [];
            for (const color of ["red", "green"]) {
                fs.writeFileSync(path.join(context, "shadow.css"), `.shadow-initial { color: ${color}; }`);
                const stats = await runCompiler(compiler);
                const filename = entryFile(stats, "shadow", ".css");
                filenames.push(filename);
                expect(source(stats, filename)).toContain(color);
                const harness = executeShadowEntrypoint({
                    property: RuntimeProperty,
                    compiler,
                    outputPath,
                    stats,
                    close: async () => {},
                });
                const root = createRoot(link => queueMicrotask(() => link.onload?.()));
                harness.runtime.add(root, {});
                expect(root.links.map(link => link.href)).toEqual([`https://extension.test/${filename}`]);
                harness.runtime.delete(root);
            }
            // Rspack can keep a CSS [chunkhash] name for a CSS-only edit; the runtime must match its emitted file.
            if (hash !== "chunkhash") expect(filenames[0]).not.toBe(filenames[1]);
        } finally {
            await closeCompiler(compiler);
            fs.rmSync(temporaryRoot, {recursive: true, force: true});
        }
    }
);

test("supports callback filename templates and includes the runtime mutation in chunk hashes", async () => {
    const filename: Filename = () => "js/[name].[chunkhash:8].js";
    const shadow = await compile({filename, mode: "production"});
    const normal = await compile({filename, mode: "production", selected: () => false});

    try {
        expect(entryFile(shadow.stats, "shadow", ".js")).not.toBe(entryFile(normal.stats, "shadow", ".js"));
    } finally {
        await shadow.close();
        await normal.close();
    }
});

test("switches the selected CSS runtime from shadow to normal and back during watch rebuilds", async () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-isolated-styles-watch-"));
    const watchFixtures = path.join(temporaryRoot, "fixtures");
    const outputPath = path.join(temporaryRoot, "dist");
    fs.cpSync(fixtures, watchFixtures, {recursive: true});
    fs.writeFileSync(path.join(watchFixtures, "watch-state.js"), "globalThis.shadowWatchState = true;\n");
    fs.writeFileSync(
        path.join(watchFixtures, "shadow.js"),
        `import "./watch-state.js";\n${fs.readFileSync(path.join(fixtures, "shadow.js"), "utf8")}`
    );
    let shadow = true;
    const compiler = createCompiler(outputPath, {
        context: watchFixtures,
        selected: entry => entry === "shadow" && shadow,
    });
    const observations: boolean[] = [];
    const watchErrors: string[] = [];

    const watcher = compiler.watch({poll: 50}, (error, stats) => {
        if (error) {
            watchErrors.push(error.message);
            return;
        }

        if (!stats || stats.hasErrors()) {
            watchErrors.push(stats?.toString({all: false, errors: true, errorDetails: true}) ?? "missing stats");
            return;
        }

        observations.push(
            source(stats, entryFile(stats, "shadow", ".js")).includes("var isolatedStyleRoots = new Map()")
        );

        if (observations.length === 1) {
            shadow = false;
            fs.writeFileSync(path.join(watchFixtures, "watch-state.js"), "globalThis.shadowWatchState = false;\n");
            watcher.invalidate();
        } else if (observations.length === 2) {
            shadow = true;
            fs.writeFileSync(path.join(watchFixtures, "watch-state.js"), "globalThis.shadowWatchState = true;\n");
            watcher.invalidate();
        }
    });

    try {
        await new Promise<void>((resolve, reject) => {
            const poll = setInterval(() => {
                if (observations.length === 3) {
                    clearInterval(poll);
                    clearTimeout(timeout);
                    resolve();
                }
            }, 10);
            const timeout = setTimeout(() => {
                clearInterval(poll);
                reject(
                    new Error(
                        `Rspack watch did not finish three rebuilds: ${JSON.stringify({observations, watchErrors})}`
                    )
                );
            }, 5_000);
        });

        expect(observations).toEqual([true, false, true]);
    } finally {
        await new Promise<void>((resolve, reject) => {
            try {
                watcher.close(resolve);
            } catch (error) {
                reject(error);
            }
        });
        fs.rmSync(temporaryRoot, {force: true, recursive: true});
    }
}, 15_000);
