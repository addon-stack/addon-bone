import type {SandboxUnresolvedDefinition} from "adnbn";
import type {TransportType} from "adnbn/transport";
import {isValidTransportDefinition, isValidTransportInitFunction} from "adnbn/entry/transport";
import {Builder as SandboxBuilder} from "adnbn/entry/sandbox";

import {Builder as ViewBuilder} from "virtual:view-framework";

import * as module from "virtual:sandbox-entrypoint";

try {
    const sandboxName = "virtual:sandbox-name";

    const {default: defaultDefinition, ...otherDefinition} = module;

    let definition: SandboxUnresolvedDefinition<TransportType> = otherDefinition;

    if (isValidTransportDefinition(defaultDefinition)) {
        definition = {...definition, ...defaultDefinition};
    } else if (isValidTransportInitFunction(defaultDefinition)) {
        definition = {...definition, init: defaultDefinition};
    }

    const {init, main, name, ...options} = definition;

    new SandboxBuilder({
        name: sandboxName,
        init,
        main,
        ...options,
    })
        .view(new ViewBuilder(options))
        .build()
        .catch(e => {
            console.error("Failed to build sandbox: ", e);
        });
} catch (e) {
    console.error("The sandbox crashed on startup:", e);
}
