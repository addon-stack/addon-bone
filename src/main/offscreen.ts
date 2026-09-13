import ProxyOffscreen from "@offscreen/providers/ProxyOffscreen";
import {parameters as offscreenParameters} from "#adnbn/offscreen";

import {
    type OffscreenDefinition,
    type OffscreenMap,
    type OffscreenName,
    type OffscreenProxyTarget,
    OffscreenReason,
    type OffscreenUnresolvedDefinition,
} from "@typing/offscreen";
import type {TransportType} from "@typing/transport";

export {OffscreenReason, OffscreenDefinition, OffscreenUnresolvedDefinition};

export type {OffscreenAlias, OffscreenMap} from "@typing/offscreen";

export const defineOffscreen = <T extends TransportType>(options: OffscreenDefinition<T>): OffscreenDefinition<T> => {
    return options;
};

export const getOffscreens = (): OffscreenMap => {
    const offscreens: OffscreenMap = new Map();

    try {
        Object.entries(offscreenParameters).forEach(([key, value]) => {
            offscreens.set(key, value);
        });
    } catch (e) {
        console.error("Failed getting offscreens: ", e);
    }

    return offscreens;
};

export const getOffscreen = <N extends OffscreenName>(name: N): OffscreenProxyTarget<N> => {
    const parameters = getOffscreens().get(name);

    if (!parameters) {
        throw new Error(`Unable to get offscreen: ${name}`);
    }

    return new ProxyOffscreen(name, parameters).get();
};
