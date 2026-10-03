import path from "path";

import CommandParser from "./CommandParser";

import type {ReadonlyConfig} from "@typing/config";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures", "command");
const parser = new CommandParser({rootDir} as ReadonlyConfig);

const parseOptions = (...parts: string[]) => {
    const file = path.join(fixtures, ...parts);

    return parser.options({file, import: file});
};

describe("CommandParser", () => {
    test("reads every command option and the adopted background schema", () => {
        expect(parseOptions("options", "full", "save.command.ts")).toEqual({
            name: "save",
            description: "Save the page",
            global: false,
            defaultKey: "Ctrl+Shift+K",
            windowsKey: "Alt+Shift+U",
            macKey: "Command+Shift+K",
            chromeosKey: "Search+K",
            linuxKey: "Ctrl+Y",
            persistent: true,
            permissions: ["storage", "tabs"],
            optionalPermissions: ["history"],
            hostPermissions: ["https://*.example.com/*"],
            optionalHostPermissions: ["https://other.test/*"],
            excludeBrowser: ["firefox"],
        });
    });

    test("keeps the internal execute action name and leaves optional values unset", () => {
        expect(parseOptions("options", "execute-action", "open.command.ts")).toEqual({
            name: "_execute_action",
            defaultKey: "Ctrl+Shift+O",
        });
    });

    test("accepts Firefox combinations before browser compatibility is checked", () => {
        expect(parseOptions("options", "firefox", "open.command.ts")).toEqual({
            defaultKey: "Ctrl+Alt+Y",
            includeBrowser: ["firefox"],
        });
    });

    test.each([
        [
            "characters",
            {
                defaultKey: "Ctrl+A",
                windowsKey: "Alt+Z",
                macKey: "MacCtrl+0",
                chromeosKey: "Search+9",
                linuxKey: "Ctrl+y",
            },
        ],
        [
            "named",
            {
                defaultKey: "Ctrl+Tab",
                windowsKey: "Alt+Shift+Insert",
                macKey: "Option+Shift+Comma",
                chromeosKey: "Search+Ctrl+Shift+Y",
                linuxKey: "Ctrl+PageDown",
            },
        ],
        [
            "navigation",
            {
                defaultKey: "Ctrl+Up",
                windowsKey: "Alt+Down",
                macKey: "Command+Left",
                chromeosKey: "Search+Right",
                linuxKey: "Ctrl+PageUp",
            },
        ],
        [
            "editing",
            {
                defaultKey: "Ctrl+Period",
                windowsKey: "Alt+Delete",
                macKey: "Command+Home",
                chromeosKey: "Search+End",
                linuxKey: "Ctrl+Space",
            },
        ],
        [
            "functions",
            {
                defaultKey: "F1",
                windowsKey: "Ctrl+Alt+F12",
                macKey: "Command+MacCtrl+Y",
                chromeosKey: "Search+Shift+Y",
                linuxKey: "Shift+F12",
            },
        ],
        [
            "media",
            {
                defaultKey: "MediaNextTrack",
                windowsKey: "MediaPlayPause",
                macKey: "MediaPrevTrack",
                chromeosKey: "MediaStop",
                linuxKey: "MediaPlayPause",
            },
        ],
    ] as const)("accepts the shared shortcut syntax for %s and preserves every value", (scenario, options) => {
        expect(parseOptions("options", "shortcuts", `${scenario}.command.ts`)).toEqual(options);
    });

    test.each([
        ["empty.ts", "", "empty components"],
        ["whitespace.ts", "Ctrl +Y", "Whitespace"],
        ["empty-component.ts", "Ctrl++Y", "empty components"],
        ["trailing-separator.ts", "Ctrl+Y+", "empty components"],
        ["wrong-separator.ts", "Ctrl-Y", 'Unknown key "Ctrl-Y"'],
        ["unknown-modifier.ts", "Control+Y", 'Unknown modifier "Control"'],
        ["repeated-modifier.ts", "Ctrl+Ctrl+Y", "Repeated modifiers"],
        ["key-order.ts", "Ctrl+Y+Shift", "key must be the last"],
        ["missing-key-name.ts", "Ctrl+Shift", "Expected one key name"],
        ["unknown-key.ts", "Ctrl+UnlistedKey", 'Unknown key "UnlistedKey"'],
        ["unsupported-key.ts", "Ctrl+Enter", 'Unknown key "Enter"'],
        ["function-range.ts", "Ctrl+F13", 'Unknown key "F13"'],
        ["media-modifier.ts", "Ctrl+MediaPlayPause", "Media keys cannot have modifiers"],
        ["missing-modifier.ts", "Y", "A modifier is required"],
    ])("rejects invalid shortcut syntax in %s with the option and value", (filename, value, reason) => {
        expect(() => parseOptions("invalid", filename)).toThrow(
            `Invalid options defaultKey in "${path.join(fixtures, "invalid", filename)}": ${JSON.stringify(value)}:`
        );

        expect(() => parseOptions("invalid", filename)).toThrow(reason);
    });

    test("does not read command options from a sibling definition", () => {
        expect(() => parseOptions("options", "sibling", "background.ts")).toThrow(
            "At least one suggested key must be defined"
        );
    });

    test("includes the source file when no suggested key is declared", () => {
        expect(() => parseOptions("invalid", "missing-key.ts")).toThrow(
            `Invalid command options in "${path.join(fixtures, "invalid", "missing-key.ts")}": At least one suggested key must be defined`
        );
    });

    test.each([
        ["key-type.ts", "defaultKey"],
        ["global-type.ts", "global"],
    ])("rejects invalid option types in %s", (filename, option) => {
        expect(() => parseOptions("invalid", filename)).toThrow(
            `Invalid options ${option} in "${path.join(fixtures, "invalid", filename)}"`
        );
    });
});
