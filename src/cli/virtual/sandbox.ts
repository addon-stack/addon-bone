import sandbox, {resolveDefinition} from "adnbn/entry/sandbox";

import {Builder as ViewBuilder} from "virtual:view-builder";

import * as module from "virtual:sandbox-entrypoint";

try {
    sandbox(resolveDefinition(module, "virtual:sandbox-name"), ViewBuilder);
} catch (e) {
    console.error("The sandbox crashed on startup:", e);
}
