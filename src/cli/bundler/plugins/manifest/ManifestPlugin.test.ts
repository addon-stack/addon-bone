/** @jest-environment node */
import fs from "fs";
import os from "os";
import path from "path";
import {rspack, type Compiler, type RspackPluginInstance, type Stats} from "@rspack/core";

import ManifestV3 from "@cli/builders/manifest/ManifestV3";
import BuildAssetsMapPlugin, {
    createEntrypointModule,
    EntrypointAssetsModule,
} from "@cli/bundler/plugins/build-assets-map";
import {GenerateModulePlugin} from "../generate-module";
import {getCompilationBuildAssets} from "@cli/bundler/utils/output";
import {Browser} from "@typing/browser";
import type {EntrypointAssetsMap} from "@typing/entrypoint";

import {getManifestHooks, type ManifestHooks} from "../utils/manifest-hooks";
import ManifestPlugin, {createManifestDependencies} from "./ManifestPlugin";

describe("createManifestDependencies", () => {
    it("keeps only initial content files static and exposes every async file as a runtime resource", () => {
        const buildAssets: EntrypointAssetsMap = {
            content: {
                initial: {
                    js: ["js/common.js", "js/content.js"],
                    css: ["css/content.css"],
                },
                async: {
                    js: ["js/lazy.js"],
                    css: ["css/lazy.css"],
                },
                assets: ["assets/image.svg"],
            },
        };

        const dependency = createManifestDependencies(buildAssets).get("content");

        expect(dependency).toBeDefined();
        expect(Array.from(dependency!.js)).toEqual(["js/common.js", "js/content.js"]);
        expect(Array.from(dependency!.css)).toEqual(["css/content.css"]);
        expect(Array.from(dependency!.assets)).toEqual(["assets/image.svg", "js/lazy.js", "css/lazy.css"]);
    });

    it("keeps background files isolated from content dependencies", () => {
        const buildAssets: EntrypointAssetsMap = {
            background: {
                initial: {
                    js: ["js/background.js"],
                    css: [],
                },
                async: {
                    js: [],
                    css: [],
                },
                assets: ["assets/background.svg"],
            },
            content: {
                initial: {
                    js: ["js/content.js"],
                    css: ["css/content.css"],
                },
                async: {
                    js: ["js/content-lazy.js"],
                    css: ["css/content-lazy.css"],
                },
                assets: ["assets/content.svg"],
            },
        };

        const dependencies = createManifestDependencies(buildAssets);
        const content = dependencies.get("content");

        expect(content).toBeDefined();
        expect(Array.from(content!.js)).toEqual(["js/content.js"]);
        expect(Array.from(content!.css)).toEqual(["css/content.css"]);
        expect(Array.from(content!.assets)).toEqual([
            "assets/content.svg",
            "js/content-lazy.js",
            "css/content-lazy.css",
        ]);
        expect(Array.from(content!.js)).not.toContain("js/background.js");
        expect(Array.from(content!.assets)).not.toContain("assets/background.svg");
    });

    it("leaves CSS routing to its consumer instead of adding isolation fields to manifest dependencies", () => {
        const map: EntrypointAssetsMap = {
            content: {
                initial: {js: ["content.js"], css: ["page.css", "panel.css"]},
                async: {js: [], css: []},
                assets: [],
            },
        };

        expect(createManifestDependencies(map).get("content")).toEqual({
            js: new Set(["content.js"]),
            css: new Set(["page.css", "panel.css"]),
            assets: new Set(),
        });
    });
});

const run = (compiler: Compiler): Promise<Stats> =>
    new Promise((resolve, reject) => {
        compiler.run((error, stats) => {
            if (error || !stats || stats.hasErrors()) {
                reject(error ?? new Error(stats?.toString({all: false, errors: true})));
            } else {
                resolve(stats);
            }
        });
    });

describe("ManifestPlugin compilation hooks", () => {
    let directory: string;
    let compiler: Compiler;

    const build = (plugin: RspackPluginInstance, reversed = false): Compiler => {
        const manifest = new ManifestPlugin(() =>
            new ManifestV3(Browser.Chrome)
                .setContentScripts(new Set([{entry: "content", matches: ["https://example.com/*"]}]))
                .addAccessibleResource({resources: ["pages/*"], matches: ["http://example.com/*"]})
                .raw({web_accessible_resources: [{resources: ["pages/*"], matches: ["https://example.com/*"]}]})
        );
        return rspack({
            context: path.join(__dirname, "tests/fixtures"),
            entry: {background: "./entry.js", content: "./entry.js"},
            mode: "production",
            devtool: false,
            output: {path: directory, filename: "[name].[contenthash:8].js"},
            plugins: [
                new GenerateModulePlugin({[EntrypointAssetsModule.request]: createEntrypointModule()}),
                new BuildAssetsMapPlugin({
                    module: EntrypointAssetsModule,
                    fullMapEntrypoint: "background",
                    cssFilename: "[name].css",
                    cssChunkFilename: "[name].css",
                }),
                ...(reversed ? [manifest, plugin] : [plugin, manifest]),
            ],
        });
    };

    beforeEach(() => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-manifest-hooks-"));
    });

    afterEach(async () => {
        await new Promise<void>((resolve, reject) => compiler.close(error => (error ? reject(error) : resolve())));
        fs.rmSync(directory, {recursive: true, force: true});
    });

    it.each([false, true])(
        "awaits preparation and validates merged output before emit (reverse plugin order: %s)",
        async reversed => {
            let prepared = false;
            let validated = false;
            compiler = build(
                {
                    apply(compiler) {
                        compiler.hooks.compilation.tap("ManifestTest", compilation => {
                            const hooks = getManifestHooks(compilation);
                            expect(getManifestHooks(compilation)).toBe(hooks);
                            hooks.prepareDependencies.tapPromise("ManifestTest", async (dependencies, assets) => {
                                await Promise.resolve();
                                const file = assets.content.initial.js[0];
                                expect(file).toMatch(/^content\.[a-f0-9]{8}\.js$/);
                                expect(compilation.getAsset(file)).toBeDefined();
                                dependencies.get("content")!.assets.add(file);
                                prepared = true;
                            });
                            hooks.validate.tapPromise("ManifestTest", async manifest => {
                                await Promise.resolve();
                                expect(prepared).toBe(true);
                                expect(compilation.getAsset("manifest.json")).toBeUndefined();
                                const rules =
                                    manifest.web_accessible_resources as chrome.runtime.ManifestV3["web_accessible_resources"];
                                expect(
                                    rules
                                        ?.filter(rule => rule.resources.includes("pages/*"))
                                        .flatMap(rule => rule.matches ?? [])
                                ).toEqual(expect.arrayContaining(["http://example.com/*", "https://example.com/*"]));
                                expect(rules?.flatMap(rule => rule.resources)).toEqual(
                                    expect.arrayContaining(manifest.content_scripts![0].js!)
                                );
                                validated = true;
                            });
                        });
                    },
                },
                reversed
            );

            const stats = await run(compiler);
            expect(validated).toBe(true);
            expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(true);
            expect(getCompilationBuildAssets(stats.compilation)!.content.assets).toEqual([]);
        }
    );

    it("does not emit an invalid manifest and starts the next compilation with fresh hooks and dependencies", async () => {
        let attempt = 0;
        const hooksSeen = new Set<ManifestHooks>();
        compiler = build({
            apply(compiler) {
                compiler.hooks.compilation.tap("ManifestTest", compilation => {
                    const hooks = getManifestHooks(compilation);
                    hooksSeen.add(hooks);
                    hooks.prepareDependencies.tapPromise("ManifestTest", async dependencies => {
                        expect(dependencies.get("content")!.assets.size).toBe(0);
                        if (attempt === 0) {
                            dependencies.get("content")!.assets.add("first-attempt.txt");
                        }
                    });
                    hooks.validate.tapPromise("ManifestTest", async () => {
                        if (attempt === 0) throw new Error("Manifest validation rejected this compilation");
                    });
                });
            },
        });

        await expect(run(compiler)).rejects.toThrow("Manifest validation rejected this compilation");
        expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(false);
        attempt++;
        const stats = await run(compiler);
        expect(hooksSeen.size).toBe(2);
        expect(stats.compilation.getAsset("manifest.json")!.source.source().toString()).not.toContain(
            "first-attempt.txt"
        );
    });
});
