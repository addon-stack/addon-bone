import {Required} from "utility-types";

import {EntrypointBuilder, EntrypointOptions} from "@typing/entrypoint";
import {BackgroundConfig} from "@typing/background";
import {Awaiter} from "@typing/helpers";

export const CommandExecuteActionName = "_execute_action";

type Tab = chrome.tabs.Tab;

export interface CommandConfig extends BackgroundConfig {
    name: string;
    description?: string;
    global?: boolean;
    defaultKey?: string;
    windowsKey?: string;
    macKey?: string;
    chromeosKey?: string;
    linuxKey?: string;
}

export type CommandOptions = CommandConfig & EntrypointOptions;

export type CommandEntrypointOptions = Partial<CommandOptions>;

export type CommandExecute = (tab: Tab | undefined, options: CommandOptions) => Awaiter<void>;

export interface CommandDefinition extends CommandEntrypointOptions {
    execute: CommandExecute;
}

export type ExecuteActionCommandDefinition = Omit<CommandDefinition, "name">;

export type CommandUnresolvedDefinition = Partial<CommandDefinition>;

export type CommandResolvedDefinition = Required<CommandDefinition, "name" | "execute">;

export type CommandBuilder = EntrypointBuilder;
