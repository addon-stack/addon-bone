import path from "path";

import SidebarParser from "./SidebarParser";

import type {ReadonlyConfig} from "@typing/config";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures", "sidebar");

const parser = new SidebarParser({rootDir} as ReadonlyConfig);

const parseOptions = (...parts: string[]) => {
    const filename = path.join(fixtures, ...parts);

    return parser.options({file: filename, import: filename});
};

describe("SidebarParser", () => {
    test("parses defineSidebar with its icon, apply flag, permissions and inherited view and CSP options", () => {
        expect(parseOptions("options", "full", "sidebar.ts")).toEqual({
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
        });
    });

    test.each(["icon", "apply"])("rejects an invalid %s value", field => {
        expect(() => parseOptions("invalid", `${field}.ts`)).toThrow(`Invalid options ${field}`);
    });
});
