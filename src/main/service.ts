import {ProxyService} from "@service/providers";

import type {ServiceDefinition, ServiceName, ServiceProxyTarget} from "@typing/service";
import type {TransportType} from "@typing/transport";

export type {ServiceDefinition};

export const defineService = <T extends TransportType>(options: ServiceDefinition<T>): ServiceDefinition<T> => {
    return options;
};

export const getService = <N extends ServiceName>(name: N): ServiceProxyTarget<N> => {
    return new ProxyService(name).get();
};
