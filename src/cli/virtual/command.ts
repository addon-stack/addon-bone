import type {CommandUnresolvedDefinition} from "adnbn";
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

    const {execute, name = commandName, ...options} = definition;

    command({
        name,
        execute,
        ...options,
    });
} catch (e) {
    console.error("The command crashed on startup:", e);
}
