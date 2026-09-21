import path from "path";
import {z} from "zod";

import AbstractParser from "./AbstractParser";

import type {ReadonlyConfig} from "@typing/config";
import type {EntrypointFile, EntrypointOptions} from "@typing/entrypoint";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures", "common");

const config = {rootDir} as ReadonlyConfig;

const file = (...parts: string[]): EntrypointFile => {
    const filename = path.join(fixtures, ...parts);

    return {file: filename, import: filename};
};

/** An entrypoint that accepts only the options shared by every entrypoint. */
class CommonParser extends AbstractParser<EntrypointOptions> {
    protected definition(): string {
        return "defineBackground";
    }

    protected schema(): z.AnyZodObject {
        return this.CommonPropertiesSchema;
    }
}

describe("AbstractParser", () => {
    describe("common options", () => {
        test("reads the build filters shared by every entrypoint", () => {
            expect(new CommonParser(config).options(file("options", "filters.ts"))).toEqual({
                includeApp: ["app"],
                excludeApp: ["legacy"],
                includeBrowser: ["chrome", "edge"],
                excludeBrowser: ["safari"],
                mode: "development",
                debug: false,
                manifestVersion: 2,
            });
        });

        test.each([
            {name: "include-browser-unknown.ts", field: "includeBrowser"},
            {name: "manifest-version.ts", field: "manifestVersion"},
        ])("rejects an invalid $field and names the file", ({name, field}) => {
            const source = file("invalid", name);

            expect(() => new CommonParser(config).options(source)).toThrow(`Invalid options ${field}`);
            expect(() => new CommonParser(config).options(source)).toThrow(source.file);
        });
    });
});
