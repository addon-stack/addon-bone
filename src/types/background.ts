import {EntrypointBuilder, EntrypointOptions} from "@typing/entrypoint";
import {Awaiter} from "@typing/helpers";

type ManifestPermissions = chrome.runtime.ManifestPermission;
type ManifestOptionalPermissions = chrome.runtime.ManifestOptionalPermission;

export const BackgroundEntryName = "background";

export interface BackgroundConfig {
    persistent?: boolean;
    permissions?: ManifestPermissions[];
    optionalPermissions?: ManifestOptionalPermissions[];
    hostPermissions?: string[];
    optionalHostPermissions?: string[];
}

export type BackgroundOptions = BackgroundConfig & EntrypointOptions;

export type BackgroundEntrypointOptions = BackgroundOptions;

export type BackgroundMainHandler = (options: BackgroundOptions) => Awaiter<void>;

export interface BackgroundDefinition extends BackgroundEntrypointOptions {
    main?: BackgroundMainHandler;
}

export type BackgroundBuilder = EntrypointBuilder;
