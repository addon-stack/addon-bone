import fs from "fs";
import path from "path";
import {rspack, type Configuration, type Compiler, type Filename, type Stats} from "@rspack/core";
import {getContentLayer} from "@cli/bundler/layers";
import stylePlugin from "@cli/plugins/style";
import type {ReadonlyConfig} from "@typing/config";
import IsolatedStylesPlugin from "@cli/bundler/plugins/isolated-styles";
import BuildAssetsMapPlugin from "@cli/bundler/plugins/build-assets-map";
import ManifestPlugin from "@cli/bundler/plugins/manifest";
import {GenerateModulePlugin} from "@cli/bundler/plugins/generate-module";
import {createRuntimeModule} from "@cli/bundler/plugins/utils";
import {RuntimeModuleRequest, RuntimeModuleReaders, EntrypointAssetsModule} from "@cli/plugins/output/runtime";
import ManifestV3 from "@cli/builders/manifest/ManifestV3";
import {Browser} from "@typing/browser";
import {ContentScriptStylesRuntimeProperty, ContentScriptWorld} from "@typing/content";

export const project = path.resolve(__dirname, "../../../../..");
export const fixtures = path.join(__dirname, "src");
export const origin = "https://extension.test/";
export const contentEntries = ["normal", "shadow", "iframe", "relay", "switch"];
export const worldLayer = getContentLayer(ContentScriptWorld.Isolated);
export const mainLayer = getContentLayer(ContentScriptWorld.Main);

interface CompilerOptions {
    filename?: Filename;
    cssFilename?: Filename;
    commonChunks?: boolean;
    selectionFile?: string;
}

// Exercise production CSS classification and delivery with one JavaScript layer per world.
export const createCompiler = async (output: string, options: CompilerOptions = {}): Promise<Compiler> => {
    const filename = options.filename ?? "js/[name].[contenthash:8].js";
    const cssFilename = options.cssFilename ?? "css/[name].[contenthash:8].css";
    let selection = "none";
    const config = {
        rootDir: project,
        app: "test",
        mergeStyles: false,
        cssDir: "",
        cssFilename,
        cssIdentName: "[local]",
    } as ReadonlyConfig;
    const handler = stylePlugin().bundler!;
    const styles = (typeof handler === "function" ? await handler({config, rspack: {}}) : handler) as Configuration;

    return rspack({
        context: fixtures,
        mode: "production",
        devtool: false,
        entry: {
            ...Object.fromEntries(contentEntries.map(name => [name, {import: "./entry.js", layer: worldLayer}])),
            main: {import: "./entry.js", layer: mainLayer, asyncChunks: false},
            popup: "./entry.js",
            background: "./background.js",
        },
        output: {
            path: output,
            filename,
            chunkFilename: filename,
            publicPath: origin,
            uniqueName: "deliverySpike",
            chunkLoadTimeout: 2_000,
        },
        resolve: {
            alias: {"adnbn/entry/content/vanilla$": path.join(project, "dist/entry/content/adapters/vanilla/index.js")},
            modules: [path.resolve(__dirname, "../src/vendor"), path.join(project, "node_modules")],
            extensions: [".js"],
        },
        resolveLoader: {modules: [path.join(project, "node_modules")]},
        module: styles.module,
        optimization: {
            minimize: false,
            concatenateModules: false,
            moduleIds: "deterministic",
            chunkIds: "deterministic",
            splitChunks: {
                cacheGroups: {
                    default: false,
                    defaultVendors: false,
                    ...(options.commonChunks === false
                        ? {}
                        : {
                              sharedContent: {
                                  layer: worldLayer,
                                  chunks: "all",
                                  minChunks: 2,
                                  minSize: 0,
                                  name: "common.content",
                              },
                          }),
                },
            },
        },
        plugins: [
            ...styles.plugins!,
            new GenerateModulePlugin({
                [RuntimeModuleRequest]: createRuntimeModule(Object.values(RuntimeModuleReaders)),
            }),
            new BuildAssetsMapPlugin({
                module: EntrypointAssetsModule,
                fullMapEntrypoint: "background",
                cssFilename,
                cssChunkFilename: cssFilename,
            }),
            new IsolatedStylesPlugin({
                cssFilename,
                cssChunkFilename: cssFilename,
                property: ContentScriptStylesRuntimeProperty,
                test: entry =>
                    ["shadow", "iframe", "relay"].includes(entry) || (entry === "switch" && selection !== "none"),
            }),
            new ManifestPlugin(
                new ManifestV3(Browser.Chrome).setContentScripts(
                    new Set([...contentEntries, "main"].map(entry => ({entry, matches: ["https://example.com/*"]})))
                )
            ),
            {
                apply(compiler) {
                    if (!options.selectionFile) {
                        return;
                    }

                    const selectionFile = options.selectionFile;
                    compiler.hooks.watchRun.tap("DeliverySelection", () => {
                        selection = JSON.parse(fs.readFileSync(selectionFile, "utf8")).isolation;
                    });
                    compiler.hooks.compilation.tap("DeliverySelection", compilation => {
                        compilation.fileDependencies.add(selectionFile);
                    });
                },
            },
        ],
    });
};

export const runCompiler = (compiler: Compiler): Promise<Stats> =>
    new Promise((resolve, reject) => {
        compiler.run((error, stats) => {
            if (error || !stats || stats.hasErrors()) {
                reject(error ?? new Error(stats?.toString({all: false, errors: true})));
            } else {
                resolve(stats);
            }
        });
    });

export const closeCompiler = (compiler: Compiler): Promise<void> =>
    new Promise((resolve, reject) => {
        compiler.close(error => (error ? reject(error) : resolve()));
    });
