import {ProxyService} from "@service/providers";

import type {ServiceName, ServiceProxyTarget} from "@service/index";
import type {TransportType} from "@typing/transport";
import {ServiceDefinition} from "@typing/service";

export type {ServiceDefinition};

export const defineService = <T extends TransportType>(options: ServiceDefinition<T>): ServiceDefinition<T> => {
    return options;
};

export const getService = <N extends ServiceName>(name: N): ServiceProxyTarget<N> => {
    return new ProxyService(name).get();
};
