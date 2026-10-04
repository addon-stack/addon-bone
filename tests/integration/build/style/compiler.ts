import {cp, mkdtemp, realpath, rm} from "fs/promises";
import os from "os";
import path from "path";
import {rspack, type Compilation, type Compiler, type Configuration, type Stats} from "@rspack/core";

import stylePlugin from "@cli/plugins/style";
import assetPlugin from "@cli/plugins/asset";
import {Browser} from "@typing/browser";
import type {ReadonlyConfig} from "@typing/config";

const project = path.resolve(__dirname, "../../../..");
export const fixtures = path.join(__dirname, "fixtures");
export const entries = ["normal", "document", "asis"];

export const createFixture = async (name = "multi-app"): Promise<string> => {
    // Rspack resolves symlinks, including the macOS temporary-directory alias.
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "adnbn style merge ")));

    try {
        await cp(path.join(fixtures, name), root, {recursive: true});
    } catch (error) {
        await rm(root, {recursive: true, force: true});

        throw error;
    }

    return root;
};

export const createCompiler = async (
    root: string,
    app: string,
    mergeStyles = true,
    overrides: Configuration = {}
): Promise<Compiler> => {
    const config = {
        rootDir: root,
        srcDir: "src",
        sharedDir: "shared",
        appsDir: "apps",
        appSrcDir: "",
        app,
        browser: Browser.Chrome,
        mergeStyles,
        cssDir: "css",
        cssFilename: "[name].css",
        cssIdentName: "[app]-[local]__[hash:base64:5]",
        assetsDir: "assets",
        assetsFilename: "[name].[contenthash:8][ext]",
    } as ReadonlyConfig;

    const settings: Configuration[] = [];

    for (const plugin of [stylePlugin(), assetPlugin()]) {
        const handler = plugin.bundler!;

        settings.push((typeof handler === "function" ? await handler({config, rspack: {}}) : handler) as Configuration);
    }

    const [styles, assets] = settings;

    return rspack({
        context: root,
        mode: "production",
        devtool: false,
        entry: Object.fromEntries(entries.map(entry => [entry, `./${entry}.js`])),
        output: {
            ...assets.output,
            path: path.join(root, "dist", app),
            filename: "[name].js",
            publicPath: "",
            library: {type: "commonjs2"},
        },
        resolve: {
            alias: {
                "@tokens": path.join(root, "src/shared/theme/_alias.scss"),
                "@font": path.join(root, "src/apps", app, "theme/fonts"),
            },
            modules: [path.join(root, "vendor"), path.join(project, "node_modules")],
        },
        resolveLoader: {modules: [path.join(project, "node_modules")]},
        optimization: {minimize: false},
        ...overrides,
        module: {rules: [...styles.module!.rules!, ...assets.module!.rules!, ...(overrides.module?.rules ?? [])]},
        plugins: [...styles.plugins!, ...assets.plugins!, ...(overrides.plugins ?? [])],
    });
};

export const runCompiler = (compiler: Compiler): Promise<Stats> =>
    new Promise((resolve, reject) => {
        compiler.run((error, stats) => {
            if (error || !stats) {
                reject(error ?? new Error("Style compilation did not return stats"));
            } else {
                resolve(stats);
            }
        });
    });

export const closeCompiler = (compiler: Compiler): Promise<void> =>
    new Promise((resolve, reject) => {
        compiler.close(error => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });

export const getCss = (compilation: Compilation, entry: string): string => {
    return compilation.entrypoints
        .get(entry)!
        .getFiles()
        .filter(file => file.endsWith(".css"))
        .map(file => compilation.getAsset(file)!.source.source().toString())
        .join("\n");
};
