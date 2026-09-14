import contentScript, {resolveDefinition} from "virtual:content-builder";

import * as module from "virtual:content-entrypoint";

try {
    contentScript(resolveDefinition(module));
} catch (e) {
    console.error("The content script crashed on startup:", e);
}
