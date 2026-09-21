import type {OffscreenUnresolvedDefinition} from "adnbn";
import type {TransportType} from "adnbn/transport";
import {isValidTransportDefinition, isValidTransportInitFunction} from "adnbn/entry/transport";
import {Builder as OffscreenBuilder} from "adnbn/entry/offscreen";

import {Builder as ViewBuilder} from "virtual:view-builder";

import * as module from "virtual:offscreen-entrypoint";

try {
    const offscreenName = "virtual:offscreen-name";

    const {default: defaultDefinition, ...otherDefinition} = module;

    let definition: OffscreenUnresolvedDefinition<TransportType> = otherDefinition;

    if (isValidTransportDefinition(defaultDefinition)) {
        definition = {...definition, ...defaultDefinition};
    } else if (isValidTransportInitFunction(defaultDefinition)) {
        definition = {...definition, init: defaultDefinition};
    }

    const {init, main, name, ...options} = definition;

    new OffscreenBuilder({
        name: offscreenName,
        init,
        main,
        ...options,
    })
        .view(new ViewBuilder(options))
        .build()
        .catch(e => {
            console.error("Failed to build offscreen: ", e);
        });
} catch (e) {
    console.error("The offscreen crashed on startup:", e);
}
