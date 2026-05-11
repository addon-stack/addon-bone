import type {CommandUnresolvedDefinition} from "adnbn";
import {resolve} from "adnbn/locale";
import command, {isValidCommandDefinition, isValidCommandExecuteFunction} from "adnbn/entry/command";

import * as module from "virtual:command-entrypoint";

try {
    const commandName = "virtual:command-name";

    const {default: defaultDefinition, ...otherDefinition} = module;

    let definition: CommandUnresolvedDefinition = otherDefinition;

    if (isValidCommandDefinition(defaultDefinition)) {
        definition = {...definition, ...defaultDefinition};
    } else if (isValidCommandExecuteFunction(defaultDefinition)) {
        definition = {...definition, execute: defaultDefinition};
    }

    const {execute, name = commandName, description, ...options} = definition;

    command({
        name,
        execute,
        description: description ? resolve(description) : undefined,
        ...options,
    });
} catch (e) {
    console.error("The command crashed on startup:", e);
}
