import relay, {resolveDefinition} from "adnbn/entry/relay";

import {Builder as ContentBuilder} from "virtual:content-builder";

import * as module from "virtual:relay-entrypoint";

try {
    relay(resolveDefinition(module, "virtual:relay-name"), ContentBuilder);
} catch (error) {
    console.error("The relay crashed on startup:", error);
}
