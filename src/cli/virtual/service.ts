import service, {resolveDefinition} from "adnbn/entry/service";

import * as module from "virtual:service-entrypoint";

try {
    service(resolveDefinition(module, "virtual:service-name"));
} catch (e) {
    console.error("The service crashed on startup:", e);
}
