import Relay from "./providers/Relay";

import type {TransportTarget} from "@typing/transport";

export interface RelayRegistry {}

export type RelayName = Extract<keyof RelayRegistry, string>;

export type RelayTarget<N extends keyof RelayRegistry> = TransportTarget<RelayRegistry, N>;

export const getRelay = <N extends RelayName>(name: N): RelayTarget<N> => {
    return new Relay<N>(name).get();
};
