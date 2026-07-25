import ProxyOffscreen from "@offscreen/providers/ProxyOffscreen";

import {offscreens as offscreenData} from "adnbn/virtual/offscreen";

import {type OffscreenDefinition, OffscreenReason, type OffscreenUnresolvedDefinition} from "@typing/offscreen";
import type {OffscreenName, OffscreenProxyTarget} from "@offscreen/index";
import type {TransportType} from "@typing/transport";

type OffscreenParameters = chrome.offscreen.CreateParameters;

export {OffscreenReason, OffscreenDefinition, OffscreenUnresolvedDefinition};

export type OffscreenAlias = string;

export type OffscreenMap = Map<OffscreenAlias, OffscreenParameters>;

export const defineOffscreen = <T extends TransportType>(options: OffscreenDefinition<T>): OffscreenDefinition<T> => {
    return options;
};

export const getOffscreens = (): OffscreenMap => {
    const offscreens: OffscreenMap = new Map();

    Object.entries(offscreenData).forEach(([key, value]) => {
        offscreens.set(key, value);
    });

    return offscreens;
};

export const getOffscreen = <N extends OffscreenName>(name: N): OffscreenProxyTarget<N> => {
    const parameters = getOffscreens().get(name);

    if (!parameters) {
        throw new Error(`Unable to get offscreen: ${name}`);
    }

    return new ProxyOffscreen(name, parameters).get();
};
