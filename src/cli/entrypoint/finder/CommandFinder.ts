import AbstractPluginFinder from "./AbstractPluginFinder";
import PluginFinder from "./PluginFinder";

import {CommandParser} from "../parser";
import {InlineNameGenerator} from "../name";

import {ReadonlyConfig} from "@typing/config";
import {CommandEntrypointOptions, CommandExecuteActionName, CommandOptions} from "@typing/command";
import {EntrypointFile, EntrypointOptionsFinder, EntrypointParser, EntrypointType} from "@typing/entrypoint";

export default class extends AbstractPluginFinder<CommandEntrypointOptions> {
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
