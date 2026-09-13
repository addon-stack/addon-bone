/** @jest-environment node */

import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import {rspack, CssExtractRspackPlugin, type Compiler, type Filename, type Stats} from "@rspack/core";

const project = path.resolve(__dirname, "../../../..");
const fixtures = path.join(__dirname, "src");
const layer = "adnbn:css:isolation";
const boundary = "// object to store loaded CSS chunks";

// Deliberately independent of production routing: this is the feasibility gate.
const createCompiler = (output: string, filename: Filename, enabled: () => boolean = () => true): Compiler =>
    rspack({
        context: fixtures,
        mode: "production",
        devtool: false,
        entry: {
            content: {import: "./entry.js", layer: "adnbn:content:isolated"},
            relay: {import: "./entry.js", layer: "adnbn:content:isolated"},
            popup: "./entry.js",
        },
        output: {path: output, filename, chunkFilename: filename, publicPath: "/", uniqueName: "routingSpike"},
        resolveLoader: {modules: [path.join(project, "node_modules")]},
        module: {
            rules: [
                {
                    test: /\.css$/,
                    type: "javascript/auto",
                    oneOf: [
                        {
                            issuerLayer: /^adnbn:content:/,
                            resourceQuery: /[?&]isolation(?:[=&]|$)/,
                            layer,
                            use: [
                                CssExtractRspackPlugin.loader,
                                {loader: "css-loader", ident: "isolation", options: {modules: false}},
                            ],
                        },
                        {
                            use: [
                                CssExtractRspackPlugin.loader,
                                {loader: "css-loader", ident: "document", options: {modules: false}},
                            ],
                        },
                    ],
                },
            ],
        },
        optimization: {
            minimize: false,
            splitChunks: {
                cacheGroups: {
                    isolated: {
                        type: "css/mini-extract",
                        layer,
                        chunks: "all",
                        enforce: true,
                        name: false,
                        priority: 100,
                    },
                },
            },
        },
        plugins: [
            new CssExtractRspackPlugin({filename: "css/[name].[contenthash:8].css"}),
            {
                apply(compiler) {
                    compiler.hooks.thisCompilation.tap("RoutingSpike", compilation => {
                        compilation.hooks.runtimeModule.tap("RoutingSpike", (module, chunk) => {
                            if (
                                !enabled() ||
                                chunk.name === "popup" ||
                                module.identifier() !== "webpack/runtime/css loading"
                            )
                                return;
                            const source = module.source;
                            if (!source || typeof source.source !== "string")
                                throw new Error("CSS runtime source unavailable");
                            if (!source.source) return;
                            const ids = Object.fromEntries(
                                [...compilation.chunks]
                                    .filter(chunk =>
                                        [...compilation.chunkGraph.getChunkModulesIterable(chunk)].some(
                                            m => m.type === "css/mini-extract" && m.layer === layer
                                        )
                                    )
                                    .map(chunk => [chunk.id, true])
                            );
                            const position = source.source.indexOf(boundary);
                            if (position < 0) throw new Error("CSS runtime seam unavailable");
                            source.source =
                                source.source.slice(0, position) +
                                `var loadPageStylesheet = loadStylesheet;
                            loadStylesheet = function(id) {
                                return ${JSON.stringify(ids)}[id]
                                    ? globalThis.loadIsolatedCss(__webpack_require__.p + __webpack_require__.miniCssF(id))
                                    : loadPageStylesheet(id);
                            };\n` +
                                source.source.slice(position);
                        });
                    });
                },
            },
        ],
    });

const run = (compiler: Compiler): Promise<Stats> =>
    new Promise((resolve, reject) =>
        compiler.run((error, stats) => {
            if (error || !stats || stats.hasErrors())
                reject(error ?? new Error(stats?.toString({all: false, errors: true})));
            else resolve(stats);
        })
    );
const close = (compiler: Compiler): Promise<void> =>
    new Promise((resolve, reject) => compiler.close(error => (error ? reject(error) : resolve())));
const css = (stats: Stats, files: Iterable<string>): string =>
    [...files]
        .filter(file => file.endsWith(".css"))
        .map(file => stats.compilation.getAsset(file)!.source.source())
        .join("\n");

test.each<Filename>([
    "[name].[contenthash:8].js",
    "[name].[chunkhash:8].js",
    "[name].[fullhash:8].js",
    () => "custom/[name].[contenthash:8].js",
])("partitions CSS before rendering chunks and leaves popup extraction intact (%s)", async filename => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-routing-"));
    const compiler = createCompiler(output, filename);
    try {
        const stats = await run(compiler);
        const popup = stats.compilation.entrypoints.get("popup")!;
        const content = stats.compilation.entrypoints.get("content")!;
        const relay = stats.compilation.entrypoints.get("relay")!;
        expect(popup.getFiles().filter(file => file.endsWith(".css"))).toHaveLength(1);
        expect(css(stats, popup.getFiles())).toContain(".nested");
        const uiChunks = [...stats.compilation.chunks].filter(chunk =>
            [...stats.compilation.chunkGraph.getChunkModulesIterable(chunk)].some(
                m => m.type === "css/mini-extract" && m.layer === layer
            )
        );
        expect(uiChunks).toHaveLength(2);
        for (const chunk of uiChunks) {
            expect(css(stats, chunk.files)).not.toContain(".page");
            expect(css(stats, chunk.files)).not.toContain(".lazy-page");
            expect([...chunk.files].some(file => file.endsWith(".js"))).toBe(false);
        }
        expect(content.getFiles()).toHaveLength(3);
        expect(
            content.getFiles().filter(file => file.endsWith(".css") && relay.getFiles().includes(file))
        ).toHaveLength(1);
        expect(content.getFiles().some(file => file.includes("background"))).toBe(false);

        const requested: {target: string; resolve(): void}[] = [];
        let context: vm.Context;
        const head = {
            appendChild(node: any) {
                node.parentNode = head;
                if (node.tagName === "SCRIPT") {
                    vm.runInContext(fs.readFileSync(path.join(output, node.src.slice(1)), "utf8"), context);
                    queueMicrotask(() => node.onload?.({type: "load", target: node}));
                } else requested.push({target: "page", resolve: () => node.onload({type: "load", target: node})});
            },
            removeChild() {},
        };
        const sandbox = {
            setTimeout,
            clearTimeout,
            console,
            document: {
                head,
                getElementsByTagName: () => [],
                createElement: (tag: string) => ({
                    tagName: tag.toUpperCase(),
                    getAttribute: () => null,
                    setAttribute() {},
                }),
            },
            loadIsolatedCss: () => new Promise<void>(resolve => requested.push({target: "isolation", resolve})),
        };
        context = vm.createContext(sandbox);
        vm.runInContext("self = globalThis", context);
        for (const file of content.getFiles().filter(file => file.endsWith(".js")))
            vm.runInContext(fs.readFileSync(path.join(output, file), "utf8"), context);
        const loaded = vm.runInContext("loadPanel()", context) as Promise<{loaded: boolean}>;
        let resolved = false;
        void loaded.then(() => {
            resolved = true;
        });
        expect(requested.map(item => item.target).sort()).toEqual(["isolation", "page"]);
        requested[0].resolve();
        await new Promise(resolve => setImmediate(resolve));
        expect(resolved).toBe(false);
        requested[1].resolve();
        await expect(loaded).resolves.toEqual(expect.objectContaining({loaded: true}));
    } finally {
        await close(compiler);
        fs.rmSync(output, {recursive: true, force: true});
    }
});

test("recomputes selective CSS routing on watch rebuilds", async () => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-routing-watch-"));
    let enabled = true;
    const compiler = createCompiler(output, "[name].[contenthash:8].js", () => enabled);
    let next: {resolve(stats: Stats): void; reject(error: Error): void};
    const result = () =>
        new Promise<Stats>((resolve, reject) => {
            next = {resolve, reject};
        });
    let pending = result();
    const watching = compiler.watch({}, (error, stats) => {
        if (error || !stats || stats.hasErrors())
            next.reject(error ?? new Error(stats?.toString({all: false, errors: true})));
        else next.resolve(stats);
    });
    try {
        for (const selection of [true, false, true]) {
            if (selection !== enabled) {
                enabled = selection;
                pending = result();
                watching.invalidate();
            }
            const stats = await pending;
            const entry = stats.compilation.entrypoints.get("content")!;
            const source = entry
                .getFiles()
                .filter(file => file.endsWith(".js"))
                .map(file => stats.compilation.getAsset(file)!.source.source())
                .join("\n");
            expect(source.includes("loadIsolatedCss")).toBe(selection);
        }
    } finally {
        await new Promise<void>(resolve => watching.close(resolve));
        await close(compiler);
        fs.rmSync(output, {recursive: true, force: true});
    }
});
