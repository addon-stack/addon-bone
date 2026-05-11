import fs from "fs";
import os from "os";
import path from "path";

import CommandParser from "./CommandParser";

import type {ReadonlyConfig} from "@typing/config";

jest.mock("../file/resolvers", () => {
    class TsResolver {
        public static make(): TsResolver {
            return new TsResolver();
        }

        public get matchPath(): {(_path: string): string | undefined} {
            return () => undefined;
        }
    }

    class ImportResolver {
        public setBaseDir(): this {
            return this;
        }

        public get(importPath: string): string {
            return importPath;
        }
    }

    return {ImportResolver, TsResolver};
});

const rootDir = path.resolve(__dirname, "../../../..");

const parse = (source: string) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-command-parser-"));
    const file = path.join(directory, "test.command.ts");

    fs.writeFileSync(file, source);

    return new CommandParser({rootDir} as ReadonlyConfig).options({file, import: file});
};

const parseError = (source: string): Error => {
    try {
        parse(source);
    } catch (error) {
        return error as Error;
    }

    throw new Error("Expected command parser to throw");
};

const command = (options: string) => `
import {defineCommand} from "adnbn";

export default defineCommand({
    ${options},
    execute() {},
});
`;

describe("CommandParser", () => {
    test("accepts browser command shortcuts", () => {
        const options = parse(
            command(`
                defaultKey: "Ctrl+Shift+Y",
                windowsKey: "Alt+Shift+U",
                linuxKey: "Ctrl+F12",
                chromeosKey: "MediaPlayPause"
            `)
        );

        expect(options.defaultKey).toBe("Ctrl+Shift+Y");
        expect(options.windowsKey).toBe("Alt+Shift+U");
        expect(options.linuxKey).toBe("Ctrl+F12");
        expect(options.chromeosKey).toBe("MediaPlayPause");
    });

    test("accepts macOS-specific command modifiers only for macKey", () => {
        const options = parse(
            command(`
                defaultKey: "Ctrl+Shift+Y",
                macKey: "Command+Shift+P"
            `)
        );

        expect(options.macKey).toBe("Command+Shift+P");

        expect(() => parse(command(`defaultKey: "Command+Shift+P"`))).toThrow("Invalid shortcut key");
        expect(() => parse(command(`linuxKey: "Option+Shift+U"`))).toThrow("Invalid shortcut key");
    });

    test("rejects modifiers with media keys", () => {
        expect(() => parse(command(`defaultKey: "Ctrl+MediaPlayPause"`))).toThrow("Invalid shortcut key");
    });

    test("includes file path when no suggested key is defined", () => {
        const error = parseError(command(`name: "missing-key"`));

        expect(error.message).toContain("At least one suggested key must be defined");
        expect(error.message).toContain("test.command.ts");
    });

    test("requires Chrome global command shortcuts to use Ctrl+Shift+[0..9]", () => {
        expect(parse(command(`global: true, defaultKey: "Ctrl+Shift+5"`)).defaultKey).toBe("Ctrl+Shift+5");

        const error = parseError(command(`global: true, defaultKey: "Ctrl+Shift+Y"`));

        expect(error.message).toContain("must use Ctrl+Shift+[0..9]");
        expect(error.message).toContain("test.command.ts");
    });
});
