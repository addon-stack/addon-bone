/** @jest-environment node */
import fs from "fs";
import os from "os";
import path from "path";
import {rspack, type Compiler, type Stats} from "@rspack/core";

import ManifestV2 from "@cli/builders/manifest/ManifestV2";
import ManifestV3 from "@cli/builders/manifest/ManifestV3";
import {Browser} from "@typing/browser";
import type {ManifestVersion} from "@typing/manifest";

import BuildAssetsMapPlugin, {createEntrypointModule, EntrypointAssetsModule} from "../build-assets-map";
import {GenerateModulePlugin} from "../generate-module";
import ManifestPlugin from "../manifest";
import ResourceAccessPlugin, {type ResourceAccessPluginOptions} from "./ResourceAccessPlugin";

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

describe("ResourceAccessPlugin", () => {
    let directory: string;
    let compiler: Compiler;

    const build = (version: ManifestVersion, options: ResourceAccessPluginOptions): Compiler => {
        const builder = version === 2 ? new ManifestV2(Browser.Chrome) : new ManifestV3(Browser.Chrome);
        builder
            .setContentScripts(new Set([{entry: "client", matches: ["*://*.example.com/*"]}]))
            .addAccessibleResource({resources: ["client.js"], matches: ["http://*.example.com/*"]})
            .raw({web_accessible_resources: [{resources: ["client.js"], matches: ["https://*.example.com/*"]}]});

        return rspack({
            context: path.join(__dirname, "tests/fixtures"),
            entry: {background: "./client.js", client: "./client.js"},
            mode: "production",
            devtool: false,
            output: {path: directory, filename: "[name].js"},
            plugins: [
                new GenerateModulePlugin({[EntrypointAssetsModule.request]: createEntrypointModule()}),
                new BuildAssetsMapPlugin({
                    module: EntrypointAssetsModule,
                    fullMapEntrypoint: "background",
                    cssFilename: "[name].css",
                    cssChunkFilename: "[name].css",
                }),
                new ManifestPlugin(builder),
                new ResourceAccessPlugin(options),
            ],
        });
    };

    beforeEach(() => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-resource-access-"));
    });

    afterEach(async () => {
        await new Promise<void>((resolve, reject) => compiler.close(error => (error ? reject(error) : resolve())));
        fs.rmSync(directory, {recursive: true, force: true});
    });

    test.each([2, 3] as const)("validates supplied file requirements against final merged MV%s WAR", async version => {
        compiler = build(version, {
            requirements: [{resource: "client.js", matches: ["*://*.example.com/*"], issuer: "Client loader"}],
        });
        await run(compiler);
        const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
        expect(manifest.web_accessible_resources).toEqual(
            version === 2
                ? ["client.js"]
                : [
                      {
                          resources: ["client.js"],
                          matches: ["http://*.example.com/*", "https://*.example.com/*"],
                      },
                  ]
        );
    });

    test("refreshes async requirements after a rejected build without expanding access", async () => {
        let resource = "missing.js";
        const resolved: string[] = [];
        compiler = build(3, {
            requirements: async () => {
                await Promise.resolve();
                resolved.push(resource);
                return [
                    {
                        resource,
                        matches: ["https://*.example.com/*"],
                        issuer: "Client loader",
                        hint: "check the client registration",
                    },
                ];
            },
        });
        await expect(run(compiler)).rejects.toThrow(/Client loader.*missing.js.*check the client registration/);
        expect(fs.existsSync(path.join(directory, "manifest.json"))).toBe(false);

        resource = "client.js";
        await run(compiler);
        expect(resolved).toEqual(["missing.js", "client.js"]);
        expect(fs.readFileSync(path.join(directory, "manifest.json"), "utf8")).not.toContain("missing.js");
    });
});
