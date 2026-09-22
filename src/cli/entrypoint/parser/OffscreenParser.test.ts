import path from "path";

import OffscreenParser from "./OffscreenParser";

import type {ReadonlyConfig} from "@typing/config";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures", "offscreen");

const parser = new OffscreenParser({rootDir} as ReadonlyConfig);

const file = (...parts: string[]) => {
    const filename = path.join(fixtures, ...parts);

    return {file: filename, import: filename};
};

describe("OffscreenParser", () => {
    describe("options", () => {
        test("parses defineOffscreen with its name, reasons and inherited view and CSP options", () => {
            expect(parser.options(file("options", "full", "audio.offscreen.ts"))).toEqual({
                name: "audio",
                reasons: ["AUDIO_PLAYBACK", "BLOBS"],
                justification: "Plays notification sounds",
                as: "panel",
                title: "Extension panel",
                template: "./template.html",
                includeBrowser: ["chrome"],
                csp: {sources: {connect: ["'self'", "https://api.example.com"]}},
                links: "extra.css",
            });
        });

        test.each(["name", "reasons"])("rejects an invalid %s value", field => {
            expect(() => parser.options(file("invalid", `${field}.ts`))).toThrow(`Invalid options ${field}`);
        });
    });

    describe("contract", () => {
        test("extracts the API returned from init", () => {
            expect(parser.contract(file("contracts", "init-object.ts"))).toBe(
                "{ volume: number; play(url: string): void; }"
            );
        });
    });
});
