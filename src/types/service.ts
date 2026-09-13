import {BackgroundConfig} from "@typing/background";
import {EntrypointOptions} from "@typing/entrypoint";
import {
    TransportConfig,
    TransportDefinition,
    TransportProxyTarget,
    TransportTarget,
    TransportType,
} from "@typing/transport";

export const ServiceGlobalKey = "adnbnService";

/**
 * Empty because service names and contracts belong to the consuming application.
 * Generated `.adnbn/service.d.ts` declarations populate it by augmenting `adnbn/service`.
 */
export interface ServiceRegistry {}

export type ServiceName = Extract<keyof ServiceRegistry, string>;

export type ServiceTarget<N extends keyof ServiceRegistry> = TransportTarget<ServiceRegistry, N>;

export type ServiceProxyTarget<N extends keyof ServiceRegistry> = TransportProxyTarget<ServiceRegistry, N>;

export type ServiceConfig = TransportConfig & BackgroundConfig;

export type ServiceOptions = ServiceConfig & EntrypointOptions;

export type ServiceEntrypointOptions = Partial<ServiceOptions>;

export type ServiceDefinition<T extends TransportType> = TransportDefinition<ServiceOptions, T> &
    ServiceEntrypointOptions;

export type ServiceUnresolvedDefinition<T extends TransportType> = Partial<ServiceDefinition<T>>;
