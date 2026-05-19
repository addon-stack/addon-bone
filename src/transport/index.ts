import type {DeepAsyncProxy} from "@typing/helpers";

export type TransportTarget<T extends object, K extends keyof T> = T[K];

export type TransportProxyTarget<T extends object, K extends keyof T> = DeepAsyncProxy<T[K]>;

export type {
    TransportDefinition,
    TransportResolvedDefinition,
    TransportUnresolvedDefinition,
    TransportType,
    TransportOptions,
} from "@typing/transport";
