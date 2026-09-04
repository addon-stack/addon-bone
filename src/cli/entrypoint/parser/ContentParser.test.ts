import path from "path";

import ContentParser from "./ContentParser";

import type {ReadonlyConfig} from "@typing/config";
import {ContentScriptWorld} from "@typing/content";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures", "content");

const parser = new ContentParser({rootDir} as ReadonlyConfig);

const file = (...parts: string[]) => {
    const filename = path.join(fixtures, ...parts);

    return {file: filename, import: filename};
};

describe("ContentParser", () => {
    test.each([
        ["enum.content.ts", ContentScriptWorld.Main],
        ["string.content.ts", ContentScriptWorld.Isolated],
    ])("parses the execution world from %s", (name, world) => {
        expect(parser.options(file("options", "world", name))).toEqual({
            matches: ["http://*/*", "https://*/*"],
            runAt: "document_idle",
            world,
        });
    });

    test.each([
        ["true.content.ts", true],
        ["false.content.ts", false],
    ])("parses the shadow literal from %s", (name, shadow) => {
        expect(parser.options(file("options", "shadow", name))).toEqual({
            matches: ["http://*/*", "https://*/*"],
            runAt: "document_idle",
            shadow,
        });
    });

    test("collapses a shadow options object containing imported runtime values to one build bit", () => {
        expect(parser.options(file("options", "shadow", "object", "entry.content.ts"))).toEqual({
            matches: ["http://*/*", "https://*/*"],
            runAt: "document_idle",
            shadow: true,
        });
    });

    test("rejects a shadow flag that cannot be evaluated during the build", () => {
        expect(() => parser.options(file("invalid", "shadow-identifier.content.ts"))).toThrow(
            /shadow must be a boolean literal or an object/
        );
    });
});
