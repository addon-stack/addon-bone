import {EntrypointBuilder, EntrypointOptions} from "@typing/entrypoint";
import {Awaiter} from "@typing/helpers";
import {PermissionsOptions} from "@typing/permissions";

export const BackgroundEntryName = "background";

export interface BackgroundConfig extends PermissionsOptions {
    persistent?: boolean;
}

export type BackgroundOptions = BackgroundConfig & EntrypointOptions;

export type BackgroundEntrypointOptions = BackgroundOptions;

export type BackgroundMainHandler = (options: BackgroundOptions) => Awaiter<void>;

export interface BackgroundDefinition extends BackgroundEntrypointOptions {
    main?: BackgroundMainHandler;
}

export type BackgroundBuilder = EntrypointBuilder;
