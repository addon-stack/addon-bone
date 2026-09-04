/** @jest-environment node */

import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";

import {type Compiler, CssExtractRspackPlugin, type Filename, rspack, type Stats} from "@rspack/core";

import ShadowStylesPlugin, {ShadowStylesRuntimeProperty} from "./ShadowStylesPlugin";

const fixtures = path.resolve(__dirname, "tests", "fixtures");
const projectRoot = path.resolve(__dirname, "../../../../..");

interface BuildResult {
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
    readonly links: FakeLink[];
    insertBefore(link: FakeLink, container: object): FakeLink;
}

interface RuntimeApi {
    add(root: FakeRoot, target: object, initialStyles: string[]): void;
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
    context?: string;
    filename?: Filename;
    mode?: "development" | "production";
    selected?: (entry: string) => boolean;
    timeout?: number;
}

const createCompiler = (outputPath: string, options: CompileOptions = {}): Compiler => {
    const filename = options.filename ?? "js/[name].[contenthash:8].js";

    return rspack({
        context: options.context ?? fixtures,
        mode: options.mode ?? "development",
        target: ["web", "es2020"],
        devtool: false,
        entry: {
            shadow: "./shadow.js",
            normal: "./normal.js",
        },
        output: {
            path: outputPath,
            clean: true,
            filename,
            chunkFilename: filename,
            publicPath: "https://extension.test/",
            globalObject: "globalThis",
            uniqueName: "shadowStylesFixture",
        },
        resolveLoader: {
            modules: [path.resolve(projectRoot, "node_modules"), "node_modules"],
        },
        module: {
            rules: [
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
            splitChunks: false,
        },
        plugins: [
            new CssExtractRspackPlugin({
                filename: "css/[name].[contenthash:8].css",
                chunkFilename: "css/[name].[contenthash:8].css",
            }),
            new ShadowStylesPlugin({
                test: options.selected ?? (entry => entry === "shadow"),
                timeout: options.timeout ?? 1_000,
            }),
        ],
    });
};

const compile = async (options: CompileOptions = {}): Promise<BuildResult> => {
    const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-shadow-styles-"));
    const compiler = createCompiler(outputPath, options);

    try {
        const stats = await runCompiler(compiler);

        return {
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
        links,
        insertBefore(link) {
            links.push(link);
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

    const getRuntime = sandbox.getShadowStylesRuntime as (() => RuntimeApi) | undefined;

    if (!getRuntime) {
        throw new Error("Shadow fixture did not expose the style runtime");
    }

    return {requestedScripts, runtime: getRuntime(), sandbox};
};

test("replaces the CSS loading runtime only for selected entrypoints", async () => {
    const result = await compile();

    try {
        const shadow = source(result.stats, entryFile(result.stats, "shadow", ".js"));
        const normal = source(result.stats, entryFile(result.stats, "normal", ".js"));

        expect(shadow).toContain(ShadowStylesRuntimeProperty);
        expect(shadow).toContain("shadowStyleRoots");
        expect(shadow).not.toContain("document.head.appendChild(linkTag)");
        expect(normal).not.toContain(ShadowStylesRuntimeProperty);
        expect(normal).toContain("document.head.appendChild(linkTag)");
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

        harness.runtime.add(rootA, {}, [initialUrl]);
        harness.runtime.add(rootB, {}, [initialUrl]);
        await (harness.sandbox.loadShadowStyles as () => Promise<unknown>)();

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
        harness.runtime.add(lateRoot, {}, [initialUrl]);
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

        await expect((harness.sandbox.loadShadowStyles as () => Promise<unknown>)()).resolves.toMatchObject({
            shadowLazy: true,
        });

        const root = createRoot(link => queueMicrotask(() => link.onload?.()));
        harness.runtime.add(root, {}, []);
        await Promise.resolve();
        await Promise.resolve();

        expect(root.links).toHaveLength(1);
        expect(root.links[0].href).toContain("shadow-lazy");
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

        harness.runtime.add(root, {}, [initialUrl]);
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

test("rejects failed and timed out styles, removes failed links and permits retry", async () => {
    const result = await compile({timeout: 20});

    try {
        const harness = executeShadowEntrypoint(result);
        let attempt = 0;
        const root = createRoot(link => {
            attempt += 1;

            if (attempt === 1) queueMicrotask(() => link.onerror?.({type: "error"}));
            if (attempt === 2) queueMicrotask(() => link.onload?.());
        });
        harness.runtime.add(root, {}, []);

        await expect((harness.sandbox.loadShadowStyles as () => Promise<unknown>)()).rejects.toThrow(
            /shadow[\s\S]*https:\/\/extension\.test\/css\/shadow-lazy/i
        );
        expect(root.links).toHaveLength(0);
        await expect((harness.sandbox.loadShadowStyles as () => Promise<unknown>)()).resolves.toMatchObject({
            shadowLazy: true,
        });

        harness.runtime.delete(root);
        const timedOut = createRoot(link => {
            if (!link.href.endsWith("/hanging.css")) queueMicrotask(() => link.onload?.());
        });
        harness.runtime.add(timedOut, {}, []);

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
    const result = await compile();

    try {
        const harness = executeShadowEntrypoint(result);
        const root = createRoot(() => undefined);
        harness.runtime.add(root, {}, []);
        const pending = harness.runtime.load("https://extension.test/css/pending.css");

        harness.runtime.delete(root);

        await expect(pending).resolves.toBeUndefined();
        await harness.runtime.load("https://extension.test/css/pending.css");
        expect(root.links).toHaveLength(1);
    } finally {
        await result.close();
    }
});

test.each([
    ["contenthash", "js/[name].[contenthash:8].js"],
    ["chunkhash", "js/[name].[chunkhash:8].js"],
    ["fullhash", "js/[name].[fullhash:8].js"],
] as const)("supports user %s filename templates", async (_hash, filename) => {
    const result = await compile({filename, mode: "production"});

    try {
        expect(entryFile(result.stats, "shadow", ".js")).toMatch(/^js\/shadow\.[a-f0-9]{8}\.js$/);
        expect(source(result.stats, entryFile(result.stats, "shadow", ".js"))).toContain(ShadowStylesRuntimeProperty);
    } finally {
        await result.close();
    }
});

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
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-shadow-styles-watch-"));
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
            source(stats, entryFile(stats, "shadow", ".js")).includes("var shadowStyleRoots = new Map()")
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
