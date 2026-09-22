import command, {resolveDefinition} from "adnbn/entry/command";

import * as module from "virtual:command-entrypoint";

try {
    command(resolveDefinition(module, "virtual:command-name"));
} catch (e) {
    console.error("The command crashed on startup:", e);
}
