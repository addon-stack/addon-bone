import {ProxyService, RegisterService, Service} from "./providers";

import type {TransportProxyTarget, TransportTarget} from "@transport/index";

export {ProxyService, RegisterService};

export interface ServiceRegistry {}

export type ServiceName = Extract<keyof ServiceRegistry, string>;

export type ServiceTarget<N extends keyof ServiceRegistry> = TransportTarget<ServiceRegistry, N>;

export type ServiceProxyTarget<N extends keyof ServiceRegistry> = TransportProxyTarget<ServiceRegistry, N>;

export const getService = <N extends ServiceName>(name: N): ServiceTarget<N> => {
    return new Service<N>(name).get();
};
