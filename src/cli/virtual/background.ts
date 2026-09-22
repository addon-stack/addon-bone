import background, {resolveDefinition} from "adnbn/entry/background";

import * as module from "virtual:background-entrypoint";

try {
    background(resolveDefinition(module));
} catch (e) {
    console.error("The background crashed on startup:", e);
}
