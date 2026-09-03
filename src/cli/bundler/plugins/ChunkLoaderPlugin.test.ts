/** @jest-environment node */

import fs from "fs";
import os from "os";
import path from "path";

import {type Compiler, rspack, type Stats} from "@rspack/core";

import ChunkLoaderPlugin from "./ChunkLoaderPlugin";

const fixtures = path.resolve(__dirname, "tests", "fixtures", "chunk-loader");

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

test("adds the extension chunk loader only to selected entrypoints with physical async chunks", async () => {
    const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-extension-chunks-"));
    const compiler = rspack({
        context: fixtures,
        mode: "development",
        target: ["web", "es2020"],
        devtool: false,
        entry: {
            selected: {
                import: "./entry.js",
                asyncChunks: true,
                layer: "selected",
                publicPath: "",
            },
            inlined: {
                import: "./entry.js",
                asyncChunks: false,
                layer: "inlined",
                publicPath: "",
            },
            unselected: "./unselected.js",
        },
        output: {
            path: outputPath,
            clean: true,
            filename: "custom/js/[name].[chunkhash:8].js",
            chunkFilename: "custom/js/[name].[chunkhash:8].js",
        },
        optimization: {
            minimize: false,
            runtimeChunk: false,
            splitChunks: false,
        },
        plugins: [new ChunkLoaderPlugin({test: entry => entry === "selected"})],
    });

    try {
        const stats = await runCompiler(compiler);
        const asyncFiles = (name: string): string[] => {
            const entrypoint = stats.compilation.entrypoints.get(name);

            if (!entrypoint) {
                throw new Error(`Entrypoint ${name} was not found`);
            }

            return entrypoint
                .getEntrypointChunk()
                .getAllAsyncChunks()
                .flatMap(chunk => Array.from(chunk.files));
        };
        const initialSource = (name: string): string => {
            const file = stats.compilation.entrypoints
                .get(name)
                ?.getFiles()
                .find(filename => filename.endsWith(".js"));

            if (!file) {
                throw new Error(`Initial JavaScript for ${name} was not found`);
            }

            return stats.compilation.getAsset(file)!.source.source().toString();
        };

        expect(asyncFiles("selected")).toEqual([expect.stringMatching(/^custom\/js\/.+\.[a-f0-9]{8}\.js$/)]);
        expect(asyncFiles("inlined")).toEqual([]);
        expect(asyncFiles("unselected")).toEqual([expect.stringMatching(/^custom\/js\/.+\.[a-f0-9]{8}\.js$/)]);

        expect(initialSource("selected")).toContain("Unable to resolve the extension URL for chunk loading");
        expect(initialSource("selected")).toContain("import(url)");
        expect(initialSource("inlined")).not.toContain("resolveExtensionChunkPublicPath");
        expect(initialSource("unselected")).not.toContain("resolveExtensionChunkPublicPath");
    } finally {
        await closeCompiler(compiler);
        fs.rmSync(outputPath, {force: true, recursive: true});
    }
});
