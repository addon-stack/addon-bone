import {z} from "zod";

import BackgroundParser from "./BackgroundParser";

import {modifyLocaleMessageKey} from "@shared/locale";

import {CommandEntrypointOptions, CommandExecuteActionName} from "@typing/command";
import {EntrypointFile} from "@typing/entrypoint";

const shortcutModifiers = new Set(["Ctrl", "Alt", "Shift", "Command", "MacCtrl", "Option", "Search"]);

// Union of the named keys accepted by supported browsers; compatibility is checked after filtering.
// https://github.com/chromium/chromium/blob/main/ui/base/accelerators/command_constants.h
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/commands#shortcut_values
const shortcutKeys = new Set([
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
    "Tab",
    "MediaNextTrack",
    "MediaPlayPause",
    "MediaPrevTrack",
    "MediaStop",
]);

export default class CommandParser extends BackgroundParser<CommandEntrypointOptions> {
    protected definition(): string[] {
        return ["defineCommand", "defineExecuteActionCommand"];
    }

    protected schema(): typeof this.CommonPropertiesSchema {
        const shortcutKeySchema = z
            .string()
            .superRefine((value, context) => {
                const reason = this.getShortcutError(value);

                if (reason) {
                    context.addIssue({code: z.ZodIssueCode.custom, message: `${JSON.stringify(value)}: ${reason}`});
                }
            })
            .optional();

        return super.schema().extend({
            name: z.string().nonempty().optional(),
            description: z.string().nonempty().optional(),
            global: z.boolean().optional(),
            defaultKey: shortcutKeySchema,
            windowsKey: shortcutKeySchema,
            macKey: shortcutKeySchema,
            chromeosKey: shortcutKeySchema,
            linuxKey: shortcutKeySchema,
        });
    }

    private getShortcutError(value: string): string | undefined {
        // Addon Bone requires a whitespace-free declaration, even where a browser accepts spaces.
        if (/\s/.test(value)) {
            return "Whitespace is not allowed in shortcuts; use a value such as Ctrl+Shift+Y";
        }

        const modifiers = value.split("+");
        const key = modifiers.pop()!;

        if (!key || modifiers.some(modifier => !modifier)) {
            return "Expected modifiers separated by '+' followed by one key; empty components are not allowed";
        }

        const unknownModifier = modifiers.find(modifier => !shortcutModifiers.has(modifier));

        if (unknownModifier) {
            return `Unknown modifier "${unknownModifier}"; the key must be the last component`;
        }

        if (new Set(modifiers).size !== modifiers.length) {
            return "Repeated modifiers are not allowed";
        }

        if (shortcutModifiers.has(key)) {
            return "Expected one key name after the modifiers";
        }

        const functionKey = /^F(?:[1-9]|1[0-2])$/.test(key);

        // Safari also accepts lowercase letters; CommandFinder checks their compatibility with other browsers.
        if (!/^[A-Za-z0-9]$/.test(key) && !functionKey && !shortcutKeys.has(key)) {
            return `Unknown key "${key}"; use a letter, a digit, F1-F12 or a supported named key`;
        }

        if (key.startsWith("Media")) {
            return modifiers.length ? "Media keys cannot have modifiers" : undefined;
        }

        if (!modifiers.length && !functionKey) {
            return "A modifier is required except for function keys and media keys";
        }

        return undefined;
    }

    public options(file: EntrypointFile): CommandEntrypointOptions {
        const {defaultKey, windowsKey, macKey, chromeosKey, linuxKey, ...options} = super.options(file);

        if ([defaultKey, windowsKey, macKey, chromeosKey, linuxKey].every(key => key === undefined)) {
            throw new Error(`Invalid command options in "${file.file}": At least one suggested key must be defined`);
        }

        return {
            ...options,
            defaultKey,
            windowsKey,
            macKey,
            chromeosKey,
            linuxKey,
            description: modifyLocaleMessageKey(options.description),
        };
    }

    protected getOptions(file: EntrypointFile): Record<string, any> {
        const instance = this.optionFile(file);

        const options = instance.getOptions();

        if (instance.getDefinition() === "defineExecuteActionCommand") {
            return {...options, name: CommandExecuteActionName};
        }

        return options;
    }
}
