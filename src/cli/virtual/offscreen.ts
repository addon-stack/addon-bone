import offscreen, {resolveDefinition} from "adnbn/entry/offscreen";

import {Builder as ViewBuilder} from "virtual:view-builder";

import * as module from "virtual:offscreen-entrypoint";

try {
    offscreen(resolveDefinition(module, "virtual:offscreen-name"), ViewBuilder);
} catch (e) {
    console.error("The offscreen crashed on startup:", e);
}
