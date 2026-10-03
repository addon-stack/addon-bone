import path from "path";

import CommandFinder from "./CommandFinder";

import {toPosix} from "@cli/utils/path";
import {Browser} from "@typing/browser";

import type {ReadonlyConfig} from "@typing/config";

const fixtures = path.resolve(__dirname, "tests", "fixtures", "command");

const makeFinder = (scenario: string, overrides: Partial<ReadonlyConfig> = {}): CommandFinder => {
    const config = {
        app: "app",
        browser: Browser.Chrome,
        appSrcDir: ".",
        appsDir: "apps",
        debug: false,
        mergeCommands: false,
        plugins: [],
        rootDir: fixtures,
        sharedDir: ".",
        srcDir: scenario,
        ...overrides,
    } as Partial<ReadonlyConfig> as ReadonlyConfig;

    const finder = new CommandFinder(config);

    config.plugins.push({name: "adnbn:background", command: () => finder.files()});

    return finder;
};

const source = (scenario: string, file: string): string => {
    return path.join(fixtures, scenario, file);
};

describe("CommandFinder", () => {
    test("reports compatibility errors for a selected command using the build browser", async () => {
        await expect(makeFinder("unsupported").commands()).rejects.toThrow(
            `Invalid command options in "${source("unsupported", "open.command.ts")}": defaultKey="Ctrl+Alt+Y" for chrome/default`
        );
        await expect(makeFinder("unsupported", {browser: Browser.Firefox}).commands()).resolves.toHaveProperty(
            "size",
            1
        );
    });

    test.each([
        [Browser.Chrome, ["chromium", "global", "shared"]],
        [Browser.Firefox, ["firefox", "shared"]],
        [Browser.Safari, ["shared"]],
    ] as const)("validates only commands selected for %s", async (browser, names) => {
        const commands = await makeFinder("compatibility", {browser}).commands();

        expect(Array.from(commands.values(), ({name}) => name).sort()).toEqual(names);
    });

    test.each([
        [
            "valid",
            {
                defaultKey: "Ctrl+Tab",
                windowsKey: "Alt+Shift+U",
                macKey: "Option+Shift+U",
                chromeosKey: "Search+Ctrl+Y",
                linuxKey: "Ctrl+Shift+Comma",
            },
        ],
        ["mac-pair", {macKey: "Command+MacCtrl+Y"}],
        [
            "global-overrides",
            {
                global: true,
                defaultKey: "Ctrl+Y",
                windowsKey: "Ctrl+Shift+1",
                linuxKey: "Ctrl+Shift+2",
                macKey: "Command+Shift+3",
            },
        ],
        [
            "media",
            {
                global: true,
                defaultKey: "MediaPlayPause",
                windowsKey: "MediaNextTrack",
                macKey: "MediaPrevTrack",
                linuxKey: "MediaStop",
            },
        ],
    ] as const)("preserves compatible Chromium shortcuts for %s", async (app, options) => {
        const commands = await makeFinder("shortcuts", {app}).commands();

        expect(Array.from(commands.values())).toEqual([expect.objectContaining(options)]);
    });

    test.each([
        ["mac-default", "only supported in macKey"],
        ["option-linux", "only supported in macKey"],
        ["macctrl-windows", "only supported in macKey"],
        ["command-chromeos", "only supported in macKey"],
        ["search-default", "only supported in chromeosKey"],
        ["search-windows", "only supported in chromeosKey"],
        ["search-mac", "only supported in chromeosKey"],
        ["search-linux", "only supported in chromeosKey"],
        ["four-mac", "at most 3 tokens"],
        ["four-chromeos", "at most 3 tokens"],
        ["function", 'Unsupported Chromium key "F12"'],
        ["lowercase", 'Unsupported Chromium key "y"'],
        ["shift", "A Ctrl or Alt modifier is required"],
        ["alt-alias", "AltGr"],
        ["search-alt", "AltGr"],
        ["global-fallback", 'defaultKey="Ctrl+Y" for chrome/linux'],
        ["global-macctrl", 'macKey="MacCtrl+Shift+3" for chrome/mac'],
        ["global-chromeos", "Global commands are not supported on ChromeOS"],
    ])("rejects incompatible Chromium shortcuts for %s", async (app, reason) => {
        const commands = makeFinder("shortcuts", {app}).commands();

        await expect(commands).rejects.toThrow(
            `Invalid command options in "${source("shortcuts", `${app}.command.ts`)}"`
        );

        await expect(commands).rejects.toThrow(reason);
    });

    test.each([Browser.Chromium, Browser.Edge, Browser.Opera])(
        "applies Chromium compatibility rules to %s",
        async browser => {
            await expect(makeFinder("shortcuts", {app: "valid", browser}).commands()).resolves.toHaveProperty(
                "size",
                1
            );

            await expect(makeFinder("shortcuts", {app: "function", browser}).commands()).rejects.toThrow(
                'Unsupported Chromium key "F12"'
            );
        }
    );

    test.each([
        ["function", {defaultKey: "Ctrl+F12"}],
        ["mac-default", {defaultKey: "Command+Shift+P"}],
        ["macctrl-windows", {windowsKey: "MacCtrl+Y"}],
        [
            "firefox-functions",
            {
                defaultKey: "F1",
                windowsKey: "Shift+F12",
                macKey: "Command+MacCtrl+Y",
                linuxKey: "Ctrl+Alt+Y",
                chromeosKey: "Search+Ctrl+Shift+Y",
            },
        ],
        [
            "firefox-media",
            {
                defaultKey: "MediaPlayPause",
                windowsKey: "MediaNextTrack",
                macKey: "MediaPrevTrack",
                linuxKey: "MediaStop",
            },
        ],
    ] as const)(
        "preserves compatible Firefox shortcuts and ignores ChromeOS compatibility for %s",
        async (app, options) => {
            const commands = await makeFinder("shortcuts", {app, browser: Browser.Firefox}).commands();

            expect(Array.from(commands.values())).toEqual([expect.objectContaining(options)]);
        }
    );

    test.each([
        ["four-mac", "at most 3 tokens"],
        ["tab", 'Unsupported Firefox key "Tab"'],
        ["lowercase", 'Unsupported Firefox key "y"'],
        ["option-linux", 'Unsupported Firefox modifier "Option"'],
        ["search-default", 'Unsupported Firefox modifier "Search"'],
        ["search-windows", 'Unsupported Firefox modifier "Search"'],
        ["search-mac", 'Unsupported Firefox modifier "Search"'],
        ["search-linux", 'Unsupported Firefox modifier "Search"'],
        ["ctrl-command", "Ctrl and Command refer to the same Firefox modifier"],
        ["shift", "Firefox requires a modifier other than Shift"],
    ])("rejects incompatible Firefox shortcuts for %s", async (app, reason) => {
        const commands = makeFinder("shortcuts", {app, browser: Browser.Firefox}).commands();

        await expect(commands).rejects.toThrow(
            `Invalid command options in "${source("shortcuts", `${app}.command.ts`)}"`
        );

        await expect(commands).rejects.toThrow(reason);
    });

    test.each([Browser.Chrome, Browser.Firefox])(
        "rejects unknown keys before filtering commands for %s",
        async browser => {
            await expect(makeFinder("invalid-syntax", {browser}).commands()).rejects.toThrow(
                `Invalid options defaultKey in "${source("invalid-syntax", "open.command.ts")}": "Ctrl+UnlistedKey": Unknown key "UnlistedKey"`
            );
        }
    );

    test.each([Browser.Firefox, Browser.Safari])(
        "warns about a shared global command for %s without rejecting it",
        async browser => {
            const warning = jest.spyOn(console, "warn").mockImplementation(() => {});

            try {
                const commands = await makeFinder("shared-global", {browser}).commands();

                expect(Array.from(commands.values())).toEqual([
                    expect.objectContaining({name: "open", global: true, defaultKey: "Ctrl+Shift+Y"}),
                ]);

                expect(warning).toHaveBeenCalledWith(
                    `Command "${source("shared-global", "open.command.ts")}": global=true is not supported by ${browser}; the shortcut will remain browser-scoped`
                );
            } finally {
                warning.mockRestore();
            }
        }
    );

    test("keeps explicit, file-derived and action command names as they are", async () => {
        const root = path.join(fixtures, "unique");
        const commands = await makeFinder("unique").commands();

        expect(
            Object.fromEntries(Array.from(commands, ([{file}, {name}]) => [toPosix(path.relative(root, file)), name]))
        ).toEqual({
            "action.command.ts": "_execute_action",
            "close.command.ts": "close",
            "open.command.ts": "open",
        });
    });

    test("rejects two commands with the same explicit name", async () => {
        await expect(makeFinder("explicit").commands()).rejects.toThrow(
            `Invalid command options in "${source("explicit", "open.command.ts")}": Command name "open" is already used by "${source("explicit", "launch.command.ts")}". Command names must be unique, set a distinct "name"`
        );
    });

    test("rejects app and shared commands that derive the same name when merged", async () => {
        await expect(makeFinder("merge", {sharedDir: "shared", mergeCommands: true}).commands()).rejects.toThrow(
            `Invalid command options in "${source("merge", "apps/app/open.command.ts")}": Command name "open" is already used by "${source("merge", "shared/open.command.ts")}". Command names must be unique, set a distinct "name"`
        );
    });

    test("rejects a second action command", async () => {
        await expect(makeFinder("action").commands()).rejects.toThrow(
            `Invalid command options in "${source("action", "toggle.command.ts")}": An action command is already defined in "${source("action", "open.command.ts")}". Only one action command is allowed`
        );
    });
});
