import path from "path";

import PageParser from "./PageParser";

import type {ReadonlyConfig} from "@typing/config";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures", "page");

const parser = new PageParser({rootDir} as ReadonlyConfig);

const file = (...parts: string[]) => {
    const filename = path.join(fixtures, ...parts);

    return {
        file: filename,
        import: filename,
    };
};

const parseOptions = (...parts: string[]) => parser.options(file(...parts));

describe("PageParser", () => {
    test("parses definePage with its name, matches, permissions and inherited view, HTML, CSP and build options", () => {
        expect(parseOptions("options", "full", "page.ts")).toEqual({
            name: "help",
            matches: ["https://example.com/*"],
            permissions: ["storage", "tabs"],
            optionalPermissions: ["topSites"],
            hostPermissions: ["https://*.example.com/*"],
            optionalHostPermissions: ["https://other.test/*"],
            as: "help-view",
            title: "Help",
            template: "./template.html",
            includeApp: ["app"],
            excludeApp: ["legacy"],
            includeBrowser: ["chrome"],
            excludeBrowser: ["firefox"],
            mode: "production",
            debug: true,
            manifestVersion: 3,
            append: false,
            useHash: true,
            usePublicPath: false,
            prependExternals: false,
            jsExtensions: [".js", ".module"],
            cssExtensions: ".css",
            scripts: "extra.js",
            links: "extra.css",
            tags: [{path: "runtime.module", type: "js"}],
            metas: {attributes: {name: "page-test", content: "enabled"}},
            csp: {
                wasm: true,
                sources: {
                    connect: ["'self'", "https://api.example.com"],
                    image: ["'self'", "data:", "blob:"],
                    style: ["'self'", "'unsafe-inline'"],
                    worker: ["blob:"],
                    frame: ["https://frame.example.com"],
                },
            },
        });
    });

    test("leaves omitted page options for later defaults", () => {
        expect(parseOptions("options", "defaults", "page.ts")).toEqual({});
    });

    test("ignores a sibling view definition", () => {
        expect(parseOptions("options", "foreign-definition", "page.ts")).toEqual({});
    });

    test.each(["name", "matches"])("rejects an invalid %s value", field => {
        expect(() => parseOptions("invalid", `${field}.ts`)).toThrow(`Invalid options ${field}`);
    });
});
