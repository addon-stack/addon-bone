import {ProxyService, RegisterService, Service} from "./providers";

import type {ServiceName, ServiceTarget} from "@typing/service";

export {ProxyService, RegisterService};

export type {ServiceRegistry, ServiceName, ServiceTarget, ServiceProxyTarget} from "@typing/service";

export const getService = <N extends ServiceName>(name: N): ServiceTarget<N> => {
    return new Service<N>(name).get();
};
