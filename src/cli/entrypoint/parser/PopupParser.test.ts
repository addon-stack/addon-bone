import path from "path";

import PopupParser from "./PopupParser";

import type {ReadonlyConfig} from "@typing/config";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures", "popup");

const parser = new PopupParser({rootDir} as ReadonlyConfig);

const parseOptions = (...parts: string[]) => {
    const filename = path.join(fixtures, ...parts);

    return parser.options({file: filename, import: filename});
};

describe("PopupParser", () => {
    test("ignores a sibling view definition", () => {
        expect(parseOptions("options", "foreign-definition", "popup.ts")).toEqual({});
    });

    test("leaves omitted options for later defaults", () => {
        expect(parseOptions("options", "defaults", "popup.ts")).toEqual({});
    });

    test("parses definePopup with its icon, apply flag, permissions and inherited view and CSP options", () => {
        expect(parseOptions("options", "full", "popup.ts")).toEqual({
            as: "panel",
            title: "Extension panel",
            template: "./template.html",
            icon: "toolbar",
            apply: false,
            includeBrowser: ["chrome"],
            csp: {sources: {connect: ["'self'", "https://api.example.com"]}},
            permissions: ["storage", "tabs"],
            optionalPermissions: ["topSites"],
            hostPermissions: ["https://*.example.com/*"],
            optionalHostPermissions: ["https://other.test/*"],
            links: "extra.css",
            append: false,
            useHash: true,
            usePublicPath: false,
            prependExternals: false,
            jsExtensions: [".js", ".module"],
            cssExtensions: ".css",
            tags: [{path: "runtime.module", type: "js"}],
            scripts: "extra.js",
            metas: {attributes: {name: "popup-test", content: "enabled"}},
        });
    });

    test.each(["icon", "apply"])("rejects an invalid %s value", field => {
        expect(() => parseOptions("invalid", `${field}.ts`)).toThrow(`Invalid options ${field}`);
    });
});
