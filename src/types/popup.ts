import {ViewDefinition, ViewOptions} from "@typing/view";
import {CspOptions} from "@typing/csp";
import {PermissionsOptions} from "@typing/permissions";
import type {IconName} from "@typing/icon";

/**
 * Empty because popup aliases depend on the consuming application's entrypoints.
 * Generated `.adnbn/popup.d.ts` declarations augment `adnbn`, adding discovered aliases as keys with value `true`.
 */
export interface PopupAliasRegistry {}

export type PopupAlias = keyof PopupAliasRegistry extends never ? string : Extract<keyof PopupAliasRegistry, string>;

/** Runtime data for selecting a popup; document titles remain view options. */
export interface PopupMapEntry {
    path?: string;
    icon?: string;
    /** Toolbar tooltip text or an unresolved locale marker, such as `@popup.account`. */
    tooltip?: string;
}

export type PopupMap = Map<PopupAlias, PopupMapEntry>;

/** Serialized popup entries supplied by the build-generated module. */
export type PopupAliasMap = Record<string, PopupMapEntry>;

export interface PopupConfig {
    icon?: IconName;
    apply?: boolean;
    /**
     * Toolbar tooltip text or a locale marker, such as `@popup.account`. Empty strings are allowed.
     * When omitted, the initial popup uses `config.action.title` or the extension name;
     * switching popups preserves the current tooltip.
     * During switching, empty or missing translations are passed to the browser as an empty title.
     * The browser controls its display, so an empty value does not guarantee a hidden tooltip.
     */
    tooltip?: string;
}

export type PopupEntrypointOptions = PopupConfig & PermissionsOptions & CspOptions & ViewOptions;

export type PopupProps = PopupEntrypointOptions;

export type PopupDefinition = PopupEntrypointOptions & ViewDefinition<PopupProps>;
