import type {EntrypointAssetsMap} from "@typing/entrypoint";

import {createManifestDependencies} from "./ManifestPlugin";

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
});
