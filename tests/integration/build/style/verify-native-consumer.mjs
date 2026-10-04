import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {rspack} from "@rspack/core";

import stylePlugin from "../../../../dist/cli/plugins/style/index.js";
import assetPlugin from "../../../../dist/cli/plugins/asset.js";

const root = process.argv[2];
const project = path.resolve(import.meta.dirname, "../../../..");
const config = {
    rootDir: root,
    srcDir: "src",
    sharedDir: "shared",
    appsDir: "apps",
    appSrcDir: "",
    app: "alpha",
    browser: "chrome",
    mergeStyles: false,
    cssDir: "css",
    cssFilename: "[name].css",
    cssIdentName: "[app]-[local]__[hash:base64:5]",
    assetsDir: "assets",
    assetsFilename: "[name].[contenthash:8][ext]",
};
const styles = await stylePlugin().bundler({config, rspack: {}});
const assets = await assetPlugin().bundler({config, rspack: {}});
const compiler = rspack({
    context: root,
    mode: "production",
    devtool: false,
    entry: {normal: "./normal.js"},
    output: {
        ...assets.output,
        path: path.join(root, "dist/native"),
        filename: "[name].js",
        publicPath: "",
        library: {type: "commonjs2"},
    },
    resolve: {
        alias: {"@font": path.join(root, "src/apps/alpha/theme/fonts")},
        modules: [path.join(project, "node_modules")],
    },
    resolveLoader: {modules: [path.join(project, "node_modules")]},
    module: {rules: [...styles.module.rules, ...assets.module.rules]},
    plugins: [...styles.plugins, ...assets.plugins],
    optimization: {minimize: false},
});

try {
    const stats = await new Promise((resolve, reject) => {
        compiler.run((error, result) => {
            if (error || !result) {
                reject(error ?? new Error("Native style compilation did not return stats"));
            } else {
                resolve(result);
            }
        });
    });

    assert.equal(stats.hasErrors(), false, stats.toString({all: false, errors: true}));
    const compilation = stats.compilation;
    const css = compilation.getAsset("css/normal.css").source.source().toString();
    const script = compilation.getAsset("normal.js").source.source().toString();
    const badge = vm.runInNewContext(`${script}\nmodule.exports.default.badge`, {module: {exports: {}}});

    assert.match(badge, /^alpha-badge__/);
    assert.equal(css.split(`.${badge}`).length - 1, 2);
    assert.match(css, /shared\.[a-f0-9]+\.svg#shape/);
    assert.match(css, /app\.[a-f0-9]+\.svg#shape/);
    assert.match(css, /Virtual\.[a-f0-9]+\.woff2#face/);
    assert.match(css, /Virtual\.[a-f0-9]+\.woff2#alias/);
    const font = compilation.getAssets().find(asset => asset.name.endsWith(".woff2"));

    assert.equal(
        font.source.source().toString(),
        await readFile(path.join(root, "src/apps/alpha/theme/fonts/Virtual.woff2"), "utf8")
    );
    console.log("Native style consumer verified");
} finally {
    await new Promise((resolve, reject) => {
        compiler.close(error => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}
