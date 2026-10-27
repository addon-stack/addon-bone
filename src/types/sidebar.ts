import {ViewDefinition, ViewOptions} from "@typing/view";
import {Browser} from "@typing/browser";
import {CspOptions} from "@typing/csp";
import {PermissionsOptions} from "@typing/permissions";
import type {IconName} from "@typing/icon";

export const SidebarAlternativeBrowsers: ReadonlySet<Browser> = new Set([Browser.Opera, Browser.Firefox]);

/**
 * Empty because sidebar aliases depend on the consuming application's entrypoints.
 * Generated `.adnbn/sidebar.d.ts` declarations augment `adnbn`, adding discovered aliases as keys with value `true`.
 */
export interface SidebarAliasRegistry {}

export type SidebarAlias = keyof SidebarAliasRegistry extends never
    ? string
    : Extract<keyof SidebarAliasRegistry, string>;

/** Runtime data for selecting a sidebar; document titles remain view options. */
export interface SidebarMapEntry {
    path?: string;
    icon?: string;
    /** Browser UI label or an unresolved locale marker, such as `@sidebar.account`. */
    label?: string;
}

export type SidebarMap = Map<SidebarAlias, SidebarMapEntry>;

/** Serialized sidebar entries supplied by the build-generated module. */
export type SidebarAliasMap = Record<string, SidebarMapEntry>;

export interface SidebarConfig {
    icon?: IconName;
    apply?: boolean;
    /**
     * Browser UI label or a locale marker, such as `@sidebar.account`; empty strings are allowed.
     * Firefox uses it for the panel heading, menu label and sidebar icon tooltip; Opera uses it for its sidebar tooltip.
     * Defaults to the extension name in the initial manifest. See changeSidebar() for switching behavior.
     * Unsupported browsers ignore it. The ordinary toolbar button is configured separately.
     */
    label?: string;
}

export type SidebarEntrypointOptions = SidebarConfig & PermissionsOptions & CspOptions & ViewOptions;

export type SidebarProps = SidebarEntrypointOptions;

export type SidebarDefinition = SidebarEntrypointOptions & ViewDefinition<SidebarProps>;
