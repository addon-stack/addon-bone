import path from "node:path";

import TypescriptConfig from "./TypescriptConfig";

import type {ReadonlyConfig} from "@typing/config";

describe("TypescriptConfig", () => {
    const rootDir = path.resolve(__dirname, "tests", "project");

    test.each([
        {name: "default directories", srcDir: "src", sharedDir: ".", alias: "src", source: "src", shared: "src"},
        {
            name: "native nested directories",
            srcDir: path.join("defaults", "src"),
            sharedDir: path.join("..", "shared", "ui"),
            alias: "defaults/src",
            source: "defaults/src",
            shared: "defaults/shared/ui",
        },
        {
            name: "portable nested directories",
            srcDir: "defaults/src",
            sharedDir: "../shared/ui",
            alias: "defaults/src",
            source: "defaults/src",
            shared: "defaults/shared/ui",
        },
        {
            name: "an explicit relative prefix",
            srcDir: `.${path.sep}src`,
            sharedDir: ".",
            alias: "./src",
            source: "src",
            shared: "src",
        },
    ])("keeps aliases and generated paths consistent for $name", ({srcDir, sharedDir, alias, source, shared}) => {
        const config = {rootDir, srcDir, sharedDir, outDir: "dist"} as ReadonlyConfig;
        const typescript = new TypescriptConfig(config);

        expect(typescript.aliases()).toEqual({
            "adnbn/browser": "@addon-core/browser",
            "adnbn/storage": "@addon-core/storage",
            [alias]: path.resolve(rootDir, source),
            "@": path.resolve(rootDir, source),
            "@shared": path.resolve(rootDir, shared),
            "~": path.resolve(rootDir, shared),
        });

        const paths = {
            [`${source}/*`]: [`../${source}/*`],
            "@/*": [`../${source}/*`],
            "@shared/*": [`../${shared}/*`],
            "~/*": [`../${shared}/*`],
        };

        expect(typescript.paths()).toEqual(paths);
        expect(typescript.json().compilerOptions?.paths).toEqual(paths);
        expect(config).toEqual({rootDir, srcDir, sharedDir, outDir: "dist"});
    });
});
