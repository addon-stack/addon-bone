import {ProxyRelay, RegisterRelay, Relay, type ProxyRelayParams} from "./providers";

import type {TransportProxyTarget, TransportTarget} from "@transport/index";

export {type ProxyRelayParams, ProxyRelay, RegisterRelay};

export interface RelayRegistry {}

export type RelayName = Extract<keyof RelayRegistry, string>;

export type RelayTarget<N extends keyof RelayRegistry> = TransportTarget<RelayRegistry, N>;

export type RelayProxyTarget<N extends keyof RelayRegistry> = TransportProxyTarget<RelayRegistry, N>;

export const getRelay = <N extends RelayName>(name: N): RelayTarget<N> => {
    return new Relay<N>(name).get();
};
