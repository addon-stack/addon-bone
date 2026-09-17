import path from "path";
import {build} from "esbuild";

describe("published content API", () => {
    const projectDir = path.resolve(__dirname, "../../../..");

    test.each([
        {
            entry: "adnbn/content",
            exports: ["ContentScriptEvent", "createAwaitFirstStrategy", "createMutationObserverStrategy"],
            functionsOnly: false,
        },
        {
            entry: "./dist/main/content.js",
            exports: ["defineContentScript", "defineContentScriptAppend"],
            functionsOnly: true,
        },
        {
            entry: "adnbn/entry/content",
            exports: ["Builder", "default", "resolveDefinition"],
            functionsOnly: false,
        },
    ])("$entry exposes its own API without rendering adapters", async ({entry, exports, functionsOnly}) => {
        const result = await build({
            absWorkingDir: projectDir,
            entryPoints: [entry],
            bundle: true,
            platform: "browser",
            format: "esm",
            tsconfigRaw: {},
            write: false,
            metafile: true,
            logLevel: "silent",
        });
        const output = Object.values(result.metafile!.outputs)[0];
        const exportedNames = functionsOnly ? output.exports.filter(name => /^[a-z]/.test(name)) : output.exports;
        expect(exportedNames.sort()).toEqual(exports);

        const inputs = Object.keys(result.metafile!.inputs).map(filename => filename.replaceAll("\\", "/"));
        expect(inputs.some(filename => filename.includes("entry/content/adapters/"))).toBe(false);
        expect(inputs.some(filename => /node_modules\/(react|react-dom)\//.test(filename))).toBe(false);

        if (entry === "adnbn/content") {
            expect(inputs).toContain("dist/content/index.js");

            // Watchers depend only on the public context contract, not lifecycle implementations.
            expect(inputs.some(filename => filename.includes("entry/content/lifecycle/"))).toBe(false);
        }
    });
});
