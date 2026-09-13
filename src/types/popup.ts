import {ViewDefinition, ViewOptions} from "@typing/view";
import {CspOptions} from "@typing/csp";
import type {ManifestPopup} from "@typing/manifest";

/**
 * Empty because popup aliases depend on the consuming application's entrypoints.
 * Generated `.adnbn/popup.d.ts` declarations augment `adnbn`, adding discovered aliases as keys with value `true`.
 */
export interface PopupAliasRegistry {}

export type PopupAlias = keyof PopupAliasRegistry extends never ? string : Extract<keyof PopupAliasRegistry, string>;

export type PopupMap = Map<PopupAlias, ManifestPopup>;

export interface PopupConfig {
    icon?: string;
    apply?: boolean;
}

export type PopupEntrypointOptions = PopupConfig & CspOptions & ViewOptions;

export type PopupProps = PopupEntrypointOptions;

export type PopupDefinition = PopupEntrypointOptions & ViewDefinition<PopupProps>;
