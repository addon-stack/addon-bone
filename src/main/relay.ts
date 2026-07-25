import RelayPermission from "@relay/RelayPermission";
import {ProxyRelay, type ProxyRelayParams} from "@relay/providers";

import {relays as relayData} from "adnbn/virtual/relay";

import type {RelayName, RelayProxyTarget} from "@relay/index";
import type {TransportType} from "@typing/transport";
import {RelayDefinition, RelayMethod, RelayOptions, RelayOptionsMap, RelayUnresolvedDefinition} from "@typing/relay";

export {RelayMethod};
export type {RelayDefinition, RelayUnresolvedDefinition};

export const defineRelay = <T extends TransportType>(options: RelayDefinition<T>): RelayDefinition<T> => {
    return options;
};

const getRelayOptionsMap = (): RelayOptionsMap => {
    const relays: RelayOptionsMap = new Map();

    Object.entries(relayData).forEach(([key, value]) => relays.set(key, value));

    return relays;
};

export const getRelay = <N extends RelayName>(name: N, params: ProxyRelayParams): RelayProxyTarget<N> => {
    const relays = getRelayOptionsMap();

    RelayPermission.init(relays);

    const options = relays.get(name);

    if (!options) {
        throw new Error(`Failed to get relay "${name}"`);
    }

    return new ProxyRelay(name, options, params).get();
};
