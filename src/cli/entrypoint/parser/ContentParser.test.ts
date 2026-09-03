import path from "path";

import ContentParser from "./ContentParser";

import type {ReadonlyConfig} from "@typing/config";
import {ContentScriptWorld} from "@typing/content";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures", "content");

const parser = new ContentParser({rootDir} as ReadonlyConfig);

const file = (name: string) => {
    const filename = path.join(fixtures, "options", "world", name);

    return {file: filename, import: filename};
};

describe("ContentParser", () => {
    test.each([
        ["enum.content.ts", ContentScriptWorld.Main],
        ["string.content.ts", ContentScriptWorld.Isolated],
    ])("parses the execution world from %s", (name, world) => {
        expect(parser.options(file(name))).toEqual({
            matches: ["http://*/*", "https://*/*"],
            runAt: "document_idle",
            world,
        });
    });
});
