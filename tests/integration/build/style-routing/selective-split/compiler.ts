import path from "path";
import fs from "fs";
import {rspack, type Filename, type Configuration, type Compiler, type Stats} from "@rspack/core";

import {getContentLayer} from "@cli/bundler/layers";
import ChunkLoaderPlugin from "@cli/bundler/plugins/chunk-loader";
import IsolatedStylesPlugin from "@cli/bundler/plugins/isolated-styles";
import ManifestPlugin from "@cli/bundler/plugins/manifest";
import BuildAssetsMapPlugin from "@cli/bundler/plugins/build-assets-map";
import ManifestV3 from "@cli/builders/manifest/ManifestV3";
import {Browser} from "@typing/browser";
import {GenerateModulePlugin} from "@cli/bundler/plugins/generate-module";
import {createRuntimeModule} from "@cli/bundler/plugins/utils";
import {RuntimeModuleRequest, RuntimeModuleReaders, EntrypointAssetsModule} from "@cli/plugins/output/runtime";
import stylePlugin from "@cli/plugins/style";
import {ContentScriptStylesRuntimeProperty, ContentScriptWorld} from "@typing/content";
import type {ReadonlyConfig} from "@typing/config";

export const project = path.resolve(__dirname, "../../../../..");
export const fixture = path.join(__dirname, "src");
export const orders = ["document-first", "document-last"] as const;

interface CompilerOptions {
    initial?: boolean;
    cssFilename?: Filename;
    selectionFile?: string;
}

export const createCompiler = async (
    output: string,
    isolated = true,
    options: CompilerOptions = {}
): Promise<Compiler> => {
    const cssFilename = options.cssFilename ?? "css/[name].[contenthash:8].css";
    const cssChunkFilename = cssFilename;
    const config = {
        rootDir: project,
        app: "selective-split",
        mergeStyles: false,
        cssDir: "",
        cssFilename,
        cssIdentName: "[local]",
    } as ReadonlyConfig;

    const handler = stylePlugin().bundler!;
    const styles = (typeof handler === "function" ? await handler({config, rspack: {}}) : handler) as Configuration;
    const layer = getContentLayer(ContentScriptWorld.Isolated);
    let isolatedDelivery = isolated;
    const selected = (entry: string) => isolatedDelivery && entry.startsWith("shadow");
    const initialEntries = options.initial
        ? Object.fromEntries(
              orders.flatMap(order =>
                  ["popup", "options", "page", "content", "relay", "shadow"].map(type => [
                      `${type}-${order}`,
                      {import: `./${order}.js`, ...(["content", "relay", "shadow"].includes(type) ? {layer} : {})},
                  ])
              )
          )
        : {};

    return rspack({
        context: fixture,
        mode: "production",
        devtool: false,
        entry: {normal: {import: "./entry.js", layer}, shadow: {import: "./entry.js", layer}, ...initialEntries},
        output: {
            path: output,
            filename: "js/[name].[contenthash:8].js",
            chunkFilename: "js/[name].[contenthash:8].js",
            publicPath: "",
            uniqueName: "selectiveSplitProbe",
            chunkLoadTimeout: 5_000,
        },
        resolve: {modules: [path.join(project, "node_modules")]},
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
                    ...(styles.optimization?.splitChunks ? styles.optimization.splitChunks.cacheGroups : {}),
                },
            },
        },
        plugins: [
            {
                apply(compiler) {
                    const file = options.selectionFile;

                    if (!file) {
                        return;
                    }

                    compiler.hooks.watchRun.tap("SelectiveSplitSelection", () => {
                        isolatedDelivery = JSON.parse(fs.readFileSync(file, "utf8")).isolation !== "none";
                    });

                    compiler.hooks.thisCompilation.tap("SelectiveSplitSelection", compilation => {
                        compilation.fileDependencies.add(file);
                    });
                },
            },
            ...styles.plugins!,
            new GenerateModulePlugin({
                [RuntimeModuleRequest]: createRuntimeModule([RuntimeModuleReaders.contentStyles]),
            }),
            new ChunkLoaderPlugin({test: entry => entry === "normal" || entry === "shadow"}),
            new IsolatedStylesPlugin({
                cssFilename,
                cssChunkFilename,
                property: ContentScriptStylesRuntimeProperty,
                test: selected,
            }),
            new BuildAssetsMapPlugin({
                module: EntrypointAssetsModule,
                fullMapEntrypoint: "background",
                cssFilename,
                cssChunkFilename,
            }),
            new ManifestPlugin(
                new ManifestV3(Browser.Chrome).setContentScripts(
                    new Set(
                        [
                            "normal",
                            "shadow",
                            ...Object.keys(initialEntries).filter(name => /^(content|relay|shadow)-/.test(name)),
                        ].map(entry => ({entry, matches: ["https://example.com/*"]}))
                    )
                )
            ),
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
