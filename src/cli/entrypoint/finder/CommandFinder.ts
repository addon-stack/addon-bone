import AbstractPluginFinder from "./AbstractPluginFinder";
import PluginFinder from "./PluginFinder";

import {CommandParser} from "../parser";
import {InlineNameGenerator} from "../name";

import {ReadonlyConfig} from "@typing/config";
import {Browser} from "@typing/browser";
import {CommandEntrypointOptions, CommandExecuteActionName, CommandOptions} from "@typing/command";
import {EntrypointFile, EntrypointOptionsFinder, EntrypointParser, EntrypointType} from "@typing/entrypoint";

interface CommandShortcut {
    modifiers: string[];
    key: string;
}

type CommandShortcutOption = "defaultKey" | "windowsKey" | "macKey" | "chromeosKey" | "linuxKey";

const chromiumBrowsers: ReadonlySet<Browser> = new Set([Browser.Chrome, Browser.Chromium, Browser.Edge, Browser.Opera]);
const macModifiers = new Set(["Command", "MacCtrl", "Option"]);
const firefoxModifiers = new Set(["Ctrl", "Alt", "Command", "MacCtrl", "Shift"]);
const mediaKeys = new Set(["MediaNextTrack", "MediaPlayPause", "MediaPrevTrack", "MediaStop"]);

// Browser profiles are explicit so extending CommandParser's syntax cannot silently broaden compatibility.
// https://github.com/chromium/chromium/blob/main/ui/base/accelerators/command_constants.h
// https://github.com/mozilla-firefox/firefox/blob/main/toolkit/modules/ShortcutUtils.sys.mjs
const commonKeys = [
    "Comma",
    "Period",
    "Up",
    "Down",
    "Left",
    "Right",
    "Insert",
    "Delete",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "Space",
];

const chromiumKeys = new Set([...commonKeys, ...mediaKeys, "Tab"]);
const firefoxKeys = new Set([...commonKeys, ...mediaKeys]);

const shortcutPlatforms: Record<CommandShortcutOption, string> = {
    defaultKey: "default",
    windowsKey: "windows",
    macKey: "mac",
    chromeosKey: "chromeos",
    linuxKey: "linux",
};

export default class CommandFinder extends AbstractPluginFinder<CommandEntrypointOptions> {
    protected _commands?: Map<EntrypointFile, CommandOptions>;

    protected readonly names: InlineNameGenerator;

    public constructor(config: ReadonlyConfig) {
        super(config);

        this.names = new InlineNameGenerator(this.type());
    }

    public type(): EntrypointType {
        return EntrypointType.Command;
    }

    protected getParser(): EntrypointParser<CommandEntrypointOptions> {
        return new CommandParser(this.config);
    }

    protected getPlugin(): EntrypointOptionsFinder<CommandEntrypointOptions> {
        return new PluginFinder(this.config, "command", this);
    }

    /**
     * A command name is its identity in the manifest and in the browser's shortcut settings,
     * so a collision fails the build instead of renaming one of the commands.
     */
    protected async getCommands(): Promise<Map<EntrypointFile, CommandOptions>> {
        const commands = new Map<EntrypointFile, CommandOptions>();
        const owners = new Map<string, EntrypointFile>();

        for (const [file, option] of await this.plugin().options()) {
            const {name = this.names.derive(file), ...definition} = option;
            const owner = owners.get(name);

            const warnings = this.validateShortcuts(file, option);

            for (const warning of warnings) {
                console.warn(`Command "${file.file}": ${warning}`);
            }

            if (owner && name === CommandExecuteActionName) {
                throw new Error(
                    `Invalid command options in "${file.file}": An action command is already defined in "${owner.file}". Only one action command is allowed`
                );
            }

            if (owner) {
                throw new Error(
                    `Invalid command options in "${file.file}": Command name "${name}" is already used by "${owner.file}". Command names must be unique, set a distinct "name"`
                );
            }

            owners.set(name, file);
            commands.set(file, {name, ...definition});
        }

        return commands;
    }

    /** Check browser compatibility only after the parser and entrypoint filters have accepted the command. */
    private validateShortcuts(file: EntrypointFile, options: CommandEntrypointOptions): string[] {
        const {browser} = this.config;
        const chromium = chromiumBrowsers.has(browser);
        const shortcuts = new Map<CommandShortcutOption, CommandShortcut>();

        const fail = (option: CommandShortcutOption, platform: string, reason: string): never => {
            throw new Error(
                `Invalid command options in "${file.file}": ${option}=${JSON.stringify(options[option])} for ${browser}/${platform}: ${reason}`
            );
        };

        for (const option of Object.keys(shortcutPlatforms) as CommandShortcutOption[]) {
            const value = options[option];

            // Firefox treats chromeosKey as an unused string, not a shortcut for one of its platforms.
            if (value === undefined || (browser === Browser.Firefox && option === "chromeosKey")) {
                continue;
            }

            // CommandParser has already checked the structure and known token names.
            const modifiers = value.split("+");
            const key = modifiers.pop()!;
            const shortcut = {modifiers, key};

            try {
                if ((chromium || browser === Browser.Firefox) && modifiers.length > 2) {
                    // ChromeOS accepts four tokens, but desktop Chromium validates every platform override.
                    const reason = "Shortcuts must contain at most 3 tokens (2 modifiers and 1 key)";

                    throw new Error(
                        chromium
                            ? `${reason} for desktop Chromium compatibility; desktop Chromium also validates chromeosKey`
                            : reason
                    );
                }

                if (chromium) {
                    this.validateChromiumShortcut(shortcut, option);
                } else if (browser === Browser.Firefox) {
                    this.validateFirefoxShortcut(shortcut);
                }
            } catch (error) {
                fail(option, shortcutPlatforms[option], (error as Error).message);
            }

            shortcuts.set(option, shortcut);
        }

        if (!options.global) {
            return [];
        }

        if (!chromium) {
            return [`global=true is not supported by ${browser}; the shortcut will remain browser-scoped`];
        }

        if (options.chromeosKey !== undefined) {
            fail("chromeosKey", "chromeos", "Global commands are not supported on ChromeOS");
        }

        // https://developer.chrome.com/docs/extensions/reference/api/commands#scope
        // defaultKey is a desktop fallback here; global commands cannot activate on ChromeOS.
        for (const platformOption of ["windowsKey", "macKey", "linuxKey"] as const) {
            const option = shortcuts.has(platformOption) ? platformOption : "defaultKey";
            const shortcut = shortcuts.get(option);

            if (!shortcut || mediaKeys.has(shortcut.key)) {
                continue;
            }

            const {modifiers, key} = shortcut;

            const primary =
                modifiers.includes("Ctrl") || (platformOption === "macKey" && modifiers.includes("Command"));

            if (modifiers.length !== 2 || !primary || !modifiers.includes("Shift") || !/^[0-9]$/.test(key)) {
                fail(
                    option,
                    shortcutPlatforms[platformOption],
                    "Global shortcuts must use Ctrl+Shift+[0..9] (Command+Shift+[0..9] also works on macOS)"
                );
            }
        }

        return [];
    }

    private validateChromiumShortcut({modifiers, key}: CommandShortcut, option: CommandShortcutOption): void {
        if (option !== "macKey" && modifiers.some(modifier => macModifiers.has(modifier))) {
            throw new Error("Command, MacCtrl and Option are only supported in macKey");
        }

        if (option !== "chromeosKey" && modifiers.includes("Search")) {
            throw new Error("Search is only supported in chromeosKey");
        }

        if (!/^[A-Z0-9]$/.test(key) && !chromiumKeys.has(key)) {
            throw new Error(
                `Unsupported Chromium key "${key}"; use an uppercase A-Z, a digit 0-9 or a supported named key`
            );
        }

        if (mediaKeys.has(key)) {
            return;
        }

        // Mac aliases follow the same AltGr restriction. Search maps to Command on ChromeOS.
        // https://github.com/chromium/chromium/blob/main/ui/base/accelerators/command.cc
        if (
            modifiers.some(modifier => modifier === "Alt" || modifier === "Option") &&
            modifiers.some(modifier => ["Ctrl", "Command", "MacCtrl", "Search"].includes(modifier))
        ) {
            throw new Error(
                "Alt/Option cannot be combined with Ctrl, Command, MacCtrl or Search (Chromium's AltGr restriction)"
            );
        }

        if (!modifiers.some(modifier => modifier !== "Shift")) {
            throw new Error("A Ctrl or Alt modifier is required (macOS equivalents and Search on ChromeOS also work)");
        }
    }

    private validateFirefoxShortcut({modifiers, key}: CommandShortcut): void {
        const unsupportedModifier = modifiers.find(modifier => !firefoxModifiers.has(modifier));

        if (unsupportedModifier) {
            throw new Error(
                `Unsupported Firefox modifier "${unsupportedModifier}"; use Ctrl, Alt, Command, MacCtrl or Shift`
            );
        }

        const functionKey = /^F(?:[1-9]|1[0-2])$/.test(key);

        if (!/^[A-Z0-9]$/.test(key) && !functionKey && !firefoxKeys.has(key)) {
            throw new Error(
                `Unsupported Firefox key "${key}"; use an uppercase A-Z, a digit 0-9, F1-F12 or a supported named key`
            );
        }

        // Firefox maps both tokens to "accel", even outside macOS.
        if (modifiers.includes("Ctrl") && modifiers.includes("Command")) {
            throw new Error("Ctrl and Command refer to the same Firefox modifier and cannot be combined");
        }

        if (!mediaKeys.has(key) && !functionKey && !modifiers.some(modifier => modifier !== "Shift")) {
            throw new Error("Firefox requires a modifier other than Shift except for function keys and media keys");
        }
    }

    public async commands(): Promise<Map<EntrypointFile, CommandOptions>> {
        return (this._commands ??= await this.getCommands());
    }

    public canMerge(): boolean {
        return this.config.mergeCommands;
    }

    public clear(): this {
        this._commands = undefined;

        return super.clear();
    }
}
