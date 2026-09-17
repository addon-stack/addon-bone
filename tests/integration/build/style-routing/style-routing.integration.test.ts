import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import {rspack, type Configuration, type Stats} from "@rspack/core";
import stylePlugin from "@cli/plugins/style";
import assetPlugin from "@cli/plugins/asset";
import optimizationPlugin from "@cli/plugins/optimization";
import {merge} from "webpack-merge";
import IsolatedStylesPlugin from "@cli/bundler/plugins/isolated-styles";
import BuildAssetsMapPlugin from "@cli/bundler/plugins/build-assets-map";
import {createRuntimeModule, getCompilationBuildAssets} from "@cli/bundler/plugins/utils";
import {RuntimeModuleRequest, RuntimeModuleReaders, EntrypointAssetsModule} from "@cli/plugins/output/runtime";
import {GenerateModulePlugin} from "@cli/bundler/plugins/generate-module";
import {getContentLayer} from "@cli/bundler/layers";
import ManifestPlugin from "@cli/bundler/plugins/manifest";
import ManifestV3 from "@cli/builders/manifest/ManifestV3";
import type {ReadonlyConfig} from "@typing/config";
import {Browser} from "@typing/browser";
import {ContentScriptStylesRuntimeProperty, ContentScriptWorld} from "@typing/content";

test.each<{
    browser: Browser;
    commonChunks: boolean;
    routing: string;
    layer: string;
    isolatedStyles: boolean;
    withoutMap?: boolean;
    cssFilename?: string;
}>([
    ...[
        {browser: Browser.Chrome, commonChunks: true, withoutMap: true},
        {browser: Browser.Chrome, commonChunks: false},
        {browser: Browser.Chrome, commonChunks: true, cssFilename: "css/[contenthash:8].css"},
        {browser: Browser.Chromium, commonChunks: true},
        {browser: Browser.Edge, commonChunks: true},
        {browser: Browser.Firefox, commonChunks: true},
        {browser: Browser.Opera, commonChunks: true},
        {browser: Browser.Safari, commonChunks: true},
    ].map(options => ({
        ...options,
        routing: "content",
        layer: getContentLayer(ContentScriptWorld.Isolated),
        isolatedStyles: true,
    })),
    {
        browser: Browser.Chrome,
        commonChunks: true,
        routing: "main",
        layer: getContentLayer(ContentScriptWorld.Main),
        isolatedStyles: true,
    },
    {
        browser: Browser.Chrome,
        commonChunks: true,
        routing: "disabled",
        isolatedStyles: false,
        layer: getContentLayer(ContentScriptWorld.Isolated),
    },
    {
        browser: Browser.Chrome,
        commonChunks: true,
        routing: "custom",
        layer: "fixture:ui",
        isolatedStyles: true,
    },
])(
    "production CSS routing preserves entry assets and CSS/WAR ($browser, commonChunks=$commonChunks, routing=$routing)",
    async ({
        browser,
        commonChunks,
        layer,
        isolatedStyles,
        withoutMap,
        cssFilename = "css/[name].[contenthash:8].css",
    }) => {
        const root = path.resolve(__dirname, "../../../..");
        const output = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-css-routing-"));

        const config = {
            rootDir: path.join(__dirname, "src"),
            app: "test",
            browser,
            commonChunks,
            mergeStyles: false,
            cssDir: "css",
            cssFilename: cssFilename.slice(4),
            cssIdentName: "[local]",
            assetsDir: "assets",
            assetsFilename: "[name].[contenthash:8][ext]",
        } as ReadonlyConfig;

        const styleHandler = stylePlugin().bundler!;
        const assetHandler = assetPlugin().bundler!;

        const styles = (
            typeof styleHandler === "function" ? await styleHandler({config, rspack: {}}) : styleHandler
        ) as Configuration;

        const assets = (
            typeof assetHandler === "function" ? await assetHandler({config, rspack: {}}) : assetHandler
        ) as Configuration;

        const optimizationHandler = optimizationPlugin().bundler!;

        const optimization = (
            typeof optimizationHandler === "function"
                ? await optimizationHandler({config, rspack: {}})
                : optimizationHandler
        ) as Configuration;

        const compiler = rspack({
            context: path.join(__dirname, "src"),
            mode: "production",
            devtool: false,
            entry: {
                background: withoutMap ? "./background-unused.js" : "./background.js",
                popup: "./runtime.entry.js",
                normal: {import: "./runtime.entry.js", layer: getContentLayer(ContentScriptWorld.Isolated)},
                dual: {import: "./dual.js", layer},
                assets: "./assets.js",
                other: "./other-assets.js",
                content: {import: "./runtime.entry.js", layer},
                relay: {import: "./runtime.entry.js", layer},
            },
            output: {...assets.output, path: output, filename: "js/[name].[chunkhash:8].js", publicPath: ""},
            resolveLoader: {modules: [path.join(root, "node_modules")]},
            resolve: {
                alias: {adnbn$: path.join(root, "dist/index.js")},
                modules: [path.join(__dirname, "src/vendor"), "node_modules"],
            },
            module: {rules: [...styles.module!.rules!, ...assets.module!.rules!]},
            optimization: {
                ...merge(optimization, styles).optimization,
                minimize: false,
                ...(commonChunks
                    ? {splitChunks: {...(merge(optimization, styles).optimization!.splitChunks as object), minSize: 0}}
                    : {}),
            },
            plugins: [
                ...styles.plugins!,
                ...assets.plugins!,
                new IsolatedStylesPlugin({
                    cssFilename,
                    cssChunkFilename: cssFilename,
                    property: ContentScriptStylesRuntimeProperty,
                    test: entry => isolatedStyles && ["content", "relay", "dual"].includes(entry),
                }),
                new GenerateModulePlugin({
                    [RuntimeModuleRequest]: createRuntimeModule(Object.values(RuntimeModuleReaders)),
                }),
                new BuildAssetsMapPlugin({
                    module: EntrypointAssetsModule,
                    fullMapEntrypoint: "background",
                    cssFilename,
                    cssChunkFilename: cssFilename,
                }),
                new ManifestPlugin(
                    new ManifestV3(browser).setContentScripts(
                        new Set([
                            {entry: "content", matches: ["https://example.com/*"]},
                            {entry: "relay", matches: ["https://example.com/*"]},
                            {entry: "dual", matches: ["https://example.com/*"]},
                            {entry: "normal", matches: ["https://example.com/*"]},
                        ])
                    )
                ),
            ],
        });

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

            const map = getCompilationBuildAssets(stats.compilation)!;

            const execute = (files: readonly string[]) => {
                const context = vm.createContext({});
                vm.runInContext("self = globalThis", context);

                for (const file of files) {
                    vm.runInContext(stats.compilation.getAsset(file)!.source.source().toString(), context);
                }

                return context;
            };

            expect(execute(map.dual.initial.js).dualAssets).toEqual({initial: map.dual.initial, async: map.dual.async});

            if (!withoutMap) {
                expect(execute(map.background.initial.js).assets).toEqual(map);
            }

            for (const asset of stats.compilation.getAssets().filter(asset => asset.name.endsWith(".js"))) {
                const source = asset.source.source().toString();

                if (!map.dual.initial.js.includes(asset.name)) {
                    expect(source).not.toContain("__adnbnBuildAssetsCurrentMap__");
                }

                if (withoutMap) {
                    expect(source).not.toContain("__adnbnBuildAssetsFullMap__");
                }
            }

            if (isolatedStyles) {
                const source = map.content.initial.js
                    .map(file => stats.compilation.getAsset(file)!.source.source().toString())
                    .join("\n");

                expect(source).toContain(ContentScriptStylesRuntimeProperty);
            }

            expect(map.assets.assets).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(/assets\/css-font\.[a-f0-9]+\.woff2$/),
                    expect.stringMatching(/assets\/direct\.[a-f0-9]+\.woff2$/),
                    expect.stringMatching(/assets\/image\.[a-f0-9]+\.svg$/),
                    expect.stringMatching(/assets\/movie\.[a-f0-9]+\.mp4$/),
                    expect.stringMatching(/assets\/document\.[a-f0-9]+\.custom$/),
                ])
            );

            expect(map.assets.assets.some(file => file.includes("inline") || /\.(js|json)$/.test(file))).toBe(false);
            expect(map.other.assets.some(file => file.includes("inline"))).toBe(true);

            const css = map.assets.initial.css
                .map(file => stats.compilation.getAsset(file)!.source.source())
                .join("\n");

            const scheme = browser === Browser.Firefox ? "moz-extension" : "chrome-extension";

            for (const name of ["css-font", "image", "movie"]) {
                const file = map.assets.assets.find(file => file.startsWith(`assets/${name}.`))!;
                // Both ?browser and ?chrome opt into an extension URL for the build target.
                expect(css).toContain(`${scheme}://__MSG_@@extension_id__/${file}`);
            }

            expect(css).toContain("data:");

            for (const entry of [map.content, map.relay]) {
                expect(entry.initial.js.some(file => file.includes("common"))).toBe(commonChunks);
                expect(Object.keys(entry.initial).sort()).toEqual(["css", "js"]);
                expect(Object.keys(entry.async).sort()).toEqual(["css", "js"]);
                expect(entry.initial.css).toHaveLength(isolatedStyles ? 2 : 1);
                expect(entry.async.css).toHaveLength(isolatedStyles ? 2 : 1);
                expect(entry.initial.js).not.toEqual(expect.arrayContaining(map.background.initial.js));
            }

            // Outside selected entries both CSS categories use ordinary document delivery.
            expect(map.popup.initial.css).toHaveLength(1);
            expect(map.popup.async.css).toHaveLength(1);
            const popupCss = map.popup.initial.css
                .map(file => stats.compilation.getAsset(file)!.source.source().toString())
                .join("\n");
            expect(popupCss).toMatch(/color:\s*red/);
            expect(popupCss).toMatch(/color:\s*blue/);

            const manifest: chrome.runtime.ManifestV3 = JSON.parse(
                stats.compilation.getAsset("manifest.json")!.source.source().toString()
            );

            const panel = map.content.initial.css.filter(file =>
                /color:\s*blue/.test(stats.compilation.getAsset(file)!.source.source().toString())
            );

            expect(panel).toHaveLength(1);
            const isolated = isolatedStyles ? panel : [];

            if (isolatedStyles) {
                expect(stats.compilation.getAsset(panel[0])!.source.source().toString()).not.toMatch(/color:\s*red/);

                expect(stats.compilation.getAsset(panel[0])!.source.source().toString()).toContain(
                    "--child-style: inherited"
                );

                expect(stats.compilation.getAsset(panel[0])!.source.source().toString()).toContain(".nested");

                expect(stats.compilation.getAsset(panel[0])!.source.source().toString()).toContain(
                    "--vendor-style: inherited"
                );
            }

            expect(manifest.content_scripts?.[0].css).toEqual(
                map.content.initial.css.filter(file => !isolated.includes(file))
            );

            expect(manifest.content_scripts?.[1].css).toEqual(
                map.relay.initial.css.filter(
                    file =>
                        !isolatedStyles ||
                        !/color:\s*blue/.test(stats.compilation.getAsset(file)!.source.source().toString())
                )
            );

            expect(manifest.content_scripts?.[3].css).toEqual(map.normal.initial.css);
            expect(map.normal.initial.css).toHaveLength(1);
            const normalCss = map.normal.initial.css
                .map(file => stats.compilation.getAsset(file)!.source.source().toString())
                .join("\n");
            expect(normalCss).toContain("--child-style: inherited");
            expect(normalCss).toMatch(/color:\s*blue/);
            expect(normalCss).toMatch(/color:\s*red/);
            const dualDocument = manifest.content_scripts?.[2].css ?? [];
            expect(dualDocument.length).toBeGreaterThan(0);

            expect(
                dualDocument.map(file => stats.compilation.getAsset(file)!.source.source().toString()).join("\n")
            ).toContain("--dual-style");

            const war = manifest.web_accessible_resources?.flatMap(rule => rule.resources) ?? [];
            expect(war).toEqual(expect.arrayContaining(isolated));

            if (cssFilename === "css/[contenthash:8].css") {
                expect(map.dual.initial.css).toHaveLength(1);
                expect(map.dual.async.css).toEqual([]);
                expect(dualDocument).toEqual(map.dual.initial.css);
                expect(war).toEqual(expect.arrayContaining(dualDocument));
            }

            expect(war).toEqual(expect.arrayContaining(map.content.async.css));
        } finally {
            await new Promise<void>((resolve, reject) => compiler.close(error => (error ? reject(error) : resolve())));
            fs.rmSync(output, {recursive: true, force: true});
        }
    }
);
