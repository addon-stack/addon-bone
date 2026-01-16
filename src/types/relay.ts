import {EntrypointOptions} from "@typing/entrypoint";
import {ContentScriptConfig, ContentScriptContext, ContentScriptDefinition} from "@typing/content";
import {TransportConfig, TransportDefinition, TransportType} from "@typing/transport";
import {Awaiter} from "@typing/helpers";

export const RelayGlobalKey = "adnbnRelay";

export enum RelayMethod {
    Scripting = "scripting",
    Messaging = "messaging",
}

export interface RelayConfig extends TransportConfig, ContentScriptConfig {
    method?: RelayMethod;
}

export type RelayOptions = RelayConfig & EntrypointOptions;

export type RelayOptionsMap = Map<string, RelayOptions>;

export type RelayEntrypointOptions = Partial<RelayOptions>;

export type RelayMainHandler<T extends TransportType> = (
    relay: T,
    context: ContentScriptContext,
    options: RelayEntrypointOptions
) => Awaiter<void>;

export interface RelayDefinition<T extends TransportType>
    extends
        Omit<TransportDefinition<RelayOptions, T>, "main">,
        Omit<ContentScriptDefinition, "main">,
        RelayEntrypointOptions {
    main?: RelayMainHandler<T>;
}

export type RelayUnresolvedDefinition<T extends TransportType> = Partial<RelayDefinition<T>>;
