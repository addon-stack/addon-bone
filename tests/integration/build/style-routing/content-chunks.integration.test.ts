import fs from "fs";
import os from "os";
import path from "path";
import {createRequire} from "module";
import {rspack, type Configuration, type NormalModule, type Stats} from "@rspack/core";
import {merge} from "webpack-merge";
import stylePlugin from "@cli/plugins/style";
import reactPlugin from "@cli/plugins/react";
import optimizationPlugin from "@cli/plugins/optimization";
import {getContentLayer, DefaultStylesLayer} from "@cli/bundler/layers";
import {GenerateModulePlugin} from "@cli/bundler/plugins/generate-module";
import {createRuntimeModule} from "@cli/bundler/plugins/utils";
import {RuntimeModuleRequest, RuntimeModuleReaders} from "@cli/plugins/output/runtime";
import IsolatedStylesPlugin from "@cli/bundler/plugins/isolated-styles";
import {ContentScriptStylesRuntimeProperty, ContentScriptWorld} from "@typing/content";
import type {ReadonlyConfig} from "@typing/config";

const root = path.resolve(__dirname, "../../../..");
const require = createRequire(import.meta.url);

test.each([true, false])(
    "content runtime modules share a world without sharing CSS policy (commonChunks=%s)",
    async commonChunks => {
        const output = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-content-chunks-"));
        const config = {
            rootDir: root,
            app: "test",
            commonChunks,
            mergeStyles: false,
            cssDir: "css",
            cssFilename: "[name].[contenthash:8].css",
            cssIdentName: "[local]",
        } as ReadonlyConfig;

        const settings: Configuration[] = [];

        for (const plugin of [stylePlugin(), reactPlugin(), optimizationPlugin()]) {
            const handler = plugin.bundler!;
            settings.push(
                (typeof handler === "function" ? await handler({config, rspack: {}}) : handler) as Configuration
            );
        }

        const worldLayer = getContentLayer(ContentScriptWorld.Isolated);
        const mainLayer = getContentLayer(ContentScriptWorld.Main);
        const compiler = rspack(
            merge(merge(settings), {
                context: path.join(__dirname, "src"),
                mode: "production",
                devtool: false,
                entry: {
                    normal: {import: "./runtime-libraries.js", layer: worldLayer},
                    shadow: {import: "./runtime-libraries.js", layer: worldLayer},
                    iframe: {import: "./runtime-libraries.js", layer: worldLayer},
                    relay: {import: "./runtime-libraries.js", layer: worldLayer},
                    main: {import: "./runtime-libraries.js", layer: mainLayer, asyncChunks: false},
                    popup: "./runtime-libraries.js",
                    background: "./background-unused.js",
                },
                output: {path: output, filename: "js/[name].[contenthash:8].js", publicPath: ""},
                resolve: {
                    alias: {
                        adnbn$: path.join(root, "dist/index.js"),
                        "adnbn/entry/content/vanilla$": path.join(root, "dist/entry/content/adapters/vanilla/index.js"),
                    },
                    modules: [path.join(__dirname, "src/vendor"), "node_modules"],
                },
                resolveLoader: {modules: [path.join(root, "node_modules")]},
                optimization: {minimize: false, concatenateModules: false},
                plugins: [
                    new IsolatedStylesPlugin({
                        test: entry => ["shadow", "iframe", "relay"].includes(entry),
                        property: ContentScriptStylesRuntimeProperty,
                        cssFilename: "css/[name].[contenthash:8].css",
                        cssChunkFilename: "css/[name].[contenthash:8].css",
                    }),
                    new GenerateModulePlugin({
                        [RuntimeModuleRequest]: createRuntimeModule(Object.values(RuntimeModuleReaders)),
                    }),
                ],
            } satisfies Configuration)
        );

        try {
            const stats = await new Promise<Stats>((resolve, reject) =>
                compiler.run((error, stats) => {
                    if (error || !stats || stats.hasErrors()) {
                        reject(error ?? new Error(stats?.toString({all: false, errors: true})));
                    } else {
                        resolve(stats);
                    }
                })
            );

            const {compilation} = stats;
            const modules = [...compilation.modules] as NormalModule[];
            const layers = (resource: string) =>
                modules.filter(module => module.resource === resource).map(module => module.layer ?? null);

            for (const resource of [
                require.resolve("react"),
                require.resolve("react-dom/client"),
                require.resolve("scheduler"),
                path.join(root, "node_modules/@addon-core/browser/dist/index.js"),
                path.join(root, "dist/entry/content/lifecycle/Builder.js"),
            ]) {
                expect(layers(resource).sort()).toEqual([worldLayer, mainLayer, null].sort());
            }

            // User components and CSS-bearing libraries share JavaScript identity within the world too.
            expect(layers(path.join(__dirname, "src/shared.js")).sort()).toEqual([worldLayer, mainLayer, null].sort());
            expect(layers(path.join(__dirname, "src/vendor/fixture-styles/index.js")).sort()).toEqual(
                [worldLayer, mainLayer, null].sort()
            );

            const builder = modules.find(
                module =>
                    module.resource === path.join(root, "dist/entry/content/lifecycle/Builder.js") &&
                    module.layer === worldLayer
            )!;
            const builderChunks = compilation.chunkGraph.getModuleChunks(builder);

            if (commonChunks) {
                expect(builderChunks).toHaveLength(1);

                for (const entry of ["normal", "shadow", "iframe", "relay"]) {
                    expect(compilation.entrypoints.get(entry)!.chunks).toContain(builderChunks[0]);
                }
            } else {
                expect(builderChunks).toHaveLength(4);
            }

            const styles = (entry: string, defaults: boolean) => {
                const chunks = compilation.entrypoints.get(entry)!.chunks;

                return chunks
                    .filter(chunk =>
                        [...compilation.chunkGraph.getChunkModulesIterable(chunk)].some(
                            module =>
                                module.type === "css/mini-extract" && (module.layer === DefaultStylesLayer) === defaults
                        )
                    )
                    .flatMap(chunk => [...chunk.files].filter(file => file.endsWith(".css")))
                    .map(file => compilation.getAsset(file)!.source.source().toString())
                    .join("\n");
            };

            for (const entry of ["normal", "shadow", "iframe", "relay", "main", "popup"]) {
                expect(styles(entry, true)).toContain("--child-style");
                expect(styles(entry, true)).toContain("--vendor-style");
                if (["shadow", "iframe", "relay"].includes(entry)) {
                    expect(styles(entry, false)).not.toContain("--vendor-style");
                } else {
                    expect(styles(entry, false)).toContain("--vendor-style");
                }
            }

            const background = compilation.entrypoints.get("background")!.getFiles();

            for (const [name, entry] of compilation.entrypoints) {
                if (name !== "background") {
                    expect(entry.getFiles().some(file => background.includes(file))).toBe(false);
                }
            }
        } finally {
            await new Promise<void>((resolve, reject) => compiler.close(error => (error ? reject(error) : resolve())));
            fs.rmSync(output, {recursive: true, force: true});
        }
    }
);
