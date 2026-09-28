import RelayPermission from "@relay/RelayPermission";
import {ProxyRelay, type ProxyRelayParams} from "@relay/providers";
import {options as relayOptions} from "#adnbn/relay";

import type {TransportType} from "@typing/transport";
import type {ContentScriptIsolation} from "@typing/content";

import {
    RelayDefinition,
    RelayAllFrames,
    RelayFrameErrorKind,
    RelayMethod,
    RelayOptionsMap,
    type RelayBatchOptions,
    type RelayBatchProxyTarget,
    type RelayName,
    type RelayProxyTarget,
    type RelayScalarOptions,
} from "@typing/relay";

export {RelayAllFrames, RelayFrameErrorKind, RelayMethod};
export {RelayDiscoveryError} from "@relay/discovery/RelayDiscovery";
export {RelayProtocolError} from "@relay/result";

export type {
    RelayAllFramesOptions,
    RelayAnyFramesOptions,
    RelayBatchOptions,
    RelayBatchProxyTarget,
    RelayBatchRpcProxy,
    RelayCallOptions,
    RelayDocumentOptions,
    RelayDocumentsOptions,
    RelayExecutionOptions,
    RelayEveryFrameOptions,
    RelayFrameError,
    RelayFrameOptions,
    RelayFrameResult,
    RelayFramesOptions,
    RelayFramesResult,
    RelayNonEmptyReadonlyArray,
    RelayProxyTarget,
    RelayResultTarget,
    RelayScalarOptions,
    RelayTopFrameOptions,
    RelayDefinition,
} from "@typing/relay";

export const defineRelay = <
    T extends TransportType,
    Data = undefined,
    const Isolation extends `${ContentScriptIsolation}` = "none",
>(
    options: RelayDefinition<T, Data, Isolation>
): RelayDefinition<T, Data, Isolation> => {
    return options;
};

const getRelayOptionsMap = (): RelayOptionsMap => {
    const relays: RelayOptionsMap = new Map();

    try {
        Object.entries(relayOptions).forEach(([name, options]) => relays.set(name, options));
    } catch (e) {
        console.error("Failed getting relays: ", e);
    }

    return relays;
};

export function getRelay<N extends RelayName>(name: N, params: number | RelayScalarOptions): RelayProxyTarget<N>;

export function getRelay<N extends RelayName>(name: N, params: RelayBatchOptions): RelayBatchProxyTarget<N>;

export function getRelay<N extends RelayName>(
    name: N,
    params: ProxyRelayParams
): RelayProxyTarget<N> | RelayBatchProxyTarget<N> {
    const relays = getRelayOptionsMap();
    const options = relays.get(name);

    if (!options) {
        throw new Error(`Failed to get relay "${name}"`);
    }

    return new ProxyRelay(name, options, params, RelayPermission.getInstance(relays)).get() as
        | RelayProxyTarget<N>
        | RelayBatchProxyTarget<N>;
}
