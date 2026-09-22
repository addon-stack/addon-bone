import path from "path";

import ServiceParser from "./ServiceParser";

import type {ReadonlyConfig} from "@typing/config";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures", "service");

const parser = new ServiceParser({rootDir} as ReadonlyConfig);

const file = (...parts: string[]) => {
    const filename = path.join(fixtures, ...parts);

    return {file: filename, import: filename};
};

describe("ServiceParser", () => {
    describe("options", () => {
        test("parses defineService with its name and inherited background options", () => {
            expect(parser.options(file("options", "full", "math.service.ts"))).toEqual({
                name: "math",
                persistent: true,
                permissions: ["storage", "tabs"],
                optionalPermissions: ["history"],
                hostPermissions: ["https://*.example.com/*"],
                optionalHostPermissions: ["https://other.test/*"],
                includeBrowser: ["chrome"],
            });
        });

        test("rejects a name that is not a valid identifier", () => {
            expect(() => parser.options(file("invalid", "name.ts"))).toThrow("Invalid options name");
        });
    });

    describe("contract", () => {
        test("extracts the API returned from init", () => {
            expect(parser.contract(file("contracts", "init-object.ts"))).toBe(
                "{ version: string; sum(a: number, b: number): number; }"
            );
        });
    });
});
