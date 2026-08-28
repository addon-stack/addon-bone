import type {RpcAsyncProxy} from "@typing/rpc";

export type {RpcAsyncProxy, RpcAsyncProxyObject} from "@typing/rpc";

export type TransportTarget<T extends object, K extends keyof T> = T[K];

export type TransportProxyTarget<T extends object, K extends keyof T> = RpcAsyncProxy<T[K]>;

export type {
    TransportDefinition,
    TransportResolvedDefinition,
    TransportUnresolvedDefinition,
    TransportType,
    TransportOptions,
} from "@typing/transport";
