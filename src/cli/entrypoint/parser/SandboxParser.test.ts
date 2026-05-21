import path from "path";

import SandboxParser from "./SandboxParser";

import type {ReadonlyConfig} from "@typing/config";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures", "sandbox");

const parser = new SandboxParser({rootDir} as ReadonlyConfig);

const file = (...parts: string[]) => {
    const filename = path.join(fixtures, ...parts);

    return {
        file: filename,
        import: filename,
    };
};

const parseOptions = (...parts: string[]) => parser.options(file(...parts));
const parseContract = (...parts: string[]) => parser.contract(file(...parts));

describe("SandboxParser", () => {
    describe("options", () => {
        test("parses full sandbox options from a real entrypoint file", () => {
            expect(parseOptions("options", "full", "sandbox.ts")).toEqual({
                as: "unsafe-parser-frame",
                title: "Unsafe parser",
                template: "./template.html",
                includeApp: ["admin"],
                excludeApp: ["legacy"],
                includeBrowser: ["chrome"],
                excludeBrowser: ["firefox"],
                mode: "production",
                debug: true,
                manifestVersion: 3,
                name: "parser",
                readyTimeout: 1000,
                requestTimeout: 2000,
                removeOnRequestTimeout: true,
                csp: {
                    eval: true,
                    inline: false,
                    allow: ["forms", "modals"],
                    sources: {
                        connect: ["'self'"],
                        image: ["'self'", "data:", "blob:"],
                        style: ["'self'", "'unsafe-inline'"],
                        font: ["'self'"],
                        media: ["blob:"],
                        worker: ["blob:"],
                        child: ["'self'"],
                    },
                },
                scripts: "extra.js",
                links: "extra.css",
                metas: {
                    attributes: {
                        name: "sandbox-test",
                        content: "enabled",
                    },
                },
            });
        });

        test("resolves imported constants and local enum values", () => {
            expect(parseOptions("options", "imported-values", "sandbox.ts")).toEqual({
                name: "importedOptions",
                readyTimeout: 500,
                requestTimeout: 1500,
                csp: {
                    eval: true,
                    inline: true,
                    allow: ["popups", "downloads"],
                    sources: {
                        image: ["data:", "blob:"],
                        connect: ["'self'"],
                    },
                },
            });
        });

        test("rejects allow-same-origin sandbox token", () => {
            expect(() => parseOptions("invalid", "allow-same-origin.ts")).toThrow("Invalid options csp, allow, 0");
        });

        test("rejects unknown sandbox source values", () => {
            expect(() => parseOptions("invalid", "unknown-source.ts")).toThrow(
                "Invalid options csp, sources, image, 0"
            );
        });

        test("rejects invalid sandbox names", () => {
            expect(() => parseOptions("invalid", "invalid-name.ts")).toThrow("Invalid options name");
        });
    });

    describe("contract", () => {
        test("extracts object literal API returned from init", () => {
            expect(parseContract("contracts", "object", "init-object.ts")).toBe(
                "{ parse(html: string): number; version: string; }"
            );
        });

        test("extracts class instance API returned from init", () => {
            expect(parseContract("contracts", "class", "init-class.ts")).toBe(
                "{ prefix: string; parse(html: string): number; normalize(html: string): string; }"
            );
        });

        test("extracts imported class instance API returned from init", () => {
            expect(parseContract("contracts", "imported", "init-imported-class.ts")).toBe(
                "{ render(template: string, values: Record<string, string>): string; count(html: string): number; }"
            );
        });
    });
});
