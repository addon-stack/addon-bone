import path from "path";

import BackgroundParser from "./BackgroundParser";

import type {ReadonlyConfig} from "@typing/config";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures", "background");

const parser = new BackgroundParser({rootDir} as ReadonlyConfig);

const parseOptions = (...parts: string[]) => {
    const filename = path.join(fixtures, ...parts);

    return parser.options({file: filename, import: filename});
};

describe("BackgroundParser", () => {
    test("parses defineBackground with persistence, permissions and build filters", () => {
        expect(parseOptions("options", "full", "background.ts")).toEqual({
            persistent: true,
            permissions: ["storage", "tabs"],
            optionalPermissions: ["history"],
            hostPermissions: ["https://*.example.com/*"],
            optionalHostPermissions: ["https://other.test/*"],
            includeApp: ["app"],
            excludeBrowser: ["safari"],
            mode: "production",
        });
    });

    test("rejects a non-boolean persistent value", () => {
        expect(() => parseOptions("invalid", "persistent.ts")).toThrow("Invalid options persistent");
    });
});
