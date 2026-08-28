import {z} from "zod";

import BackgroundParser from "./BackgroundParser";

import {modifyLocaleMessageKey} from "@locale/utils";

import {CommandEntrypointOptions, CommandExecuteActionName} from "@typing/command";
import {EntrypointFile} from "@typing/entrypoint";

export default class extends BackgroundParser<CommandEntrypointOptions> {
    protected definition(): string[] {
        return ["defineCommand", "defineExecuteActionCommand"];
    }

    protected schema(): typeof this.CommonPropertiesSchema {
        const key =
            "(?:[A-Z0-9]|F(?:[1-9]|1[0-2])|Comma|Period|Home|End|PageUp|PageDown|Space|Insert|Delete|Up|Down|Left|Right)";
        const mediaKey = "(?:MediaNextTrack|MediaPlayPause|MediaPrevTrack|MediaStop)";
        const shortcutMessage =
            "Invalid shortcut key, expected format like: Ctrl+Shift+K, Alt+Shift+U, or MediaPlayPause";
        const macShortcutMessage =
            "Invalid mac shortcut key, expected format like: Command+Shift+P, MacCtrl+K, Option+Shift+U, or MediaPlayPause";

        const ShortcutKeySchema = z
            .string()
            .regex(new RegExp(`^(?:(?:Ctrl|Alt)(?:\\+Shift)?\\+${key}|${mediaKey})$`), shortcutMessage)
            .optional();

        const MacShortcutKeySchema = z
            .string()
            .regex(
                new RegExp(`^(?:(?:Ctrl|Alt|Command|MacCtrl|Option)(?:\\+Shift)?\\+${key}|${mediaKey})$`),
                macShortcutMessage
            )
            .optional();

        return super.schema().extend({
            name: z.string().nonempty().optional(),
            description: z.string().nonempty().optional(),
            global: z.boolean().optional(),
            defaultKey: ShortcutKeySchema,
            windowsKey: ShortcutKeySchema,
            macKey: MacShortcutKeySchema,
            chromeosKey: ShortcutKeySchema,
            linuxKey: ShortcutKeySchema,
        });
    }

    public options(file: EntrypointFile): CommandEntrypointOptions {
        const {defaultKey, windowsKey, macKey, chromeosKey, linuxKey, ...options} = super.options(file);

        if (!defaultKey && !windowsKey && !macKey && !chromeosKey && !linuxKey) {
            throw new Error(`Invalid command options in "${file.file}": At least one suggested key must be defined`);
        }

        if (options.global) {
            const globalShortcut = /^Ctrl\+Shift\+[0-9]$/;
            const keys = {defaultKey, windowsKey, macKey, chromeosKey, linuxKey};
            const invalidKey = Object.entries(keys).find(([, key]) => key && !globalShortcut.test(key));

            if (invalidKey) {
                throw new Error(
                    `Invalid command options in "${file.file}": Global command shortcut "${invalidKey[1]}" in "${invalidKey[0]}" must use Ctrl+Shift+[0..9]`
                );
            }
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
