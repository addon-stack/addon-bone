import path from "path";

import OptionsParser from "./OptionsParser";

import type {ReadonlyConfig} from "@typing/config";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures", "options");

const parser = new OptionsParser({rootDir} as ReadonlyConfig);

const file = (...parts: string[]) => {
    const filename = path.join(fixtures, ...parts);

    return {
        file: filename,
        import: filename,
    };
};

const parseOptions = (...parts: string[]) => parser.options(file(...parts));

describe("OptionsParser", () => {
    test("parses defineOptions with inherited view, CSP and build filters", () => {
        expect(parseOptions("options", "full", "options.ts")).toEqual({
            openInTab: true,
            as: "settings",
            title: "Extension options",
            template: "./template.html",
            includeApp: ["app"],
            excludeApp: ["legacy"],
            includeBrowser: ["chrome"],
            excludeBrowser: ["safari"],
            mode: "production",
            debug: true,
            manifestVersion: 3,
            csp: {
                wasm: true,
                sources: {
                    connect: ["'self'", "https://api.example.com"],
                    image: ["'self'", "data:", "blob:"],
                    style: ["'self'", "'unsafe-inline'"],
                },
            },
            scripts: "extra.js",
            links: "extra.css",
            metas: {
                attributes: {
                    name: "options-test",
                    content: "enabled",
                },
            },
        });
    });

    test("leaves omitted openInTab for the manifest builder to default", () => {
        expect(parseOptions("options", "defaults", "options.ts")).toEqual({});
    });

    test("reads named exports alongside a default render function", () => {
        expect(parseOptions("options", "named-exports", "options.ts")).toEqual({
            openInTab: false,
            title: "Named options",
        });
    });

    test("keeps explicit false from a default object over a named export", () => {
        expect(parseOptions("options", "default-object", "options.ts")).toEqual({
            openInTab: false,
            title: "Default options",
        });
    });

    test.each(["default-as", "default-satisfies"])("reads a %s definition", scenario => {
        expect(parseOptions("options", scenario, "options.ts")).toEqual({
            openInTab: false,
            title: "Typed options",
        });
    });

    test("rejects a non-boolean openInTab value", () => {
        expect(() => parseOptions("invalid", "open-in-tab.ts")).toThrow("Invalid options openInTab");
    });
});
