import path from "path";

import BookmarksParser from "./BookmarksParser";
import HistoryParser from "./HistoryParser";
import NewtabParser from "./NewtabParser";

import type {ReadonlyConfig} from "@typing/config";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures");

const config = {rootDir} as ReadonlyConfig;

// The override parsers share one schema, including the permissions contract adopted by the family,
// and differ only in the definition they recognise.
describe.each([
    {type: "newtab", label: "New tab", parser: new NewtabParser(config)},
    {type: "bookmarks", label: "Bookmarks", parser: new BookmarksParser(config)},
    {type: "history", label: "History", parser: new HistoryParser(config)},
])("$type parser", ({type, label, parser}) => {
    const parseOptions = (scenario: string) => {
        const filename = path.join(fixtures, type, "options", scenario, `${type}.ts`);

        return parser.options({file: filename, import: filename});
    };

    test("parses its own definition with permissions and inherited view, CSP and build filters", () => {
        expect(parseOptions("full")).toEqual({
            as: "dashboard",
            title: `${label} override`,
            template: "./template.html",
            includeApp: ["app"],
            excludeApp: ["legacy"],
            includeBrowser: ["chrome"],
            excludeBrowser: ["opera"],
            mode: "production",
            debug: true,
            manifestVersion: 3,
            csp: {
                wasm: true,
                sources: {
                    connect: ["'self'", "https://api.example.com"],
                    image: ["'self'", "data:", "blob:"],
                },
            },
            permissions: ["storage", "tabs"],
            optionalPermissions: ["topSites"],
            hostPermissions: ["https://*.example.com/*"],
            optionalHostPermissions: ["https://other.test/*"],
            scripts: "extra.js",
            links: "extra.css",
            metas: {
                attributes: {
                    name: `${type}-test`,
                    content: "enabled",
                },
            },
        });
    });

    test("ignores options wrapped in another override definition", () => {
        expect(parseOptions("foreign-definition")).toEqual({});
    });
});
