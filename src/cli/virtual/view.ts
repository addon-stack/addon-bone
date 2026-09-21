import view, {resolveDefinition} from "virtual:view-builder";

import * as module from "virtual:view-entrypoint";

try {
    view(resolveDefinition(module));
} catch (e) {
    console.error("The view crashed on startup:", e);
}
