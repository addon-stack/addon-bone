import path from "path";

import PageParser from "./PageParser";

import type {ReadonlyConfig} from "@typing/config";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures", "page");

const parser = new PageParser({rootDir} as ReadonlyConfig);

const file = (...parts: string[]) => {
    const filename = path.join(fixtures, ...parts);

    return {
        file: filename,
        import: filename,
    };
};

const parseOptions = (...parts: string[]) => parser.options(file(...parts));

describe("PageParser", () => {
    test("parses view CSP options from a real entrypoint file", () => {
        expect(parseOptions("options", "csp", "page.ts")).toEqual({
            name: "help",
            csp: {
                wasm: true,
                sources: {
                    connect: ["'self'", "https://api.example.com"],
                    image: ["'self'", "data:", "blob:"],
                    style: ["'self'", "'unsafe-inline'"],
                    worker: ["blob:"],
                    frame: ["https://frame.example.com"],
                },
            },
        });
    });
});
