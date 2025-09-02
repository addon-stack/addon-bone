import {ProxyRelay, RegisterRelay, Relay, type ProxyRelayParams} from "./providers";

import type {
    TransportDictionary,
    TransportName,
    TransportProxyTarget as RelayProxyTarget,
    TransportTarget as RelayTarget,
} from "@typing/transport";

export {type RelayTarget, type RelayProxyTarget, type ProxyRelayParams, ProxyRelay, RegisterRelay};

export const getRelay = <N extends TransportName>(name: N): TransportDictionary[N] => {
    return new Relay<N>(name).get();
};
