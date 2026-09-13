import {ViewDefinition, ViewOptions} from "@typing/view";
import {Browser} from "@typing/browser";
import {CspOptions} from "@typing/csp";
import type {ManifestSidebar} from "@typing/manifest";

export const SidebarAlternativeBrowsers: ReadonlySet<Browser> = new Set([Browser.Opera, Browser.Firefox]);

/**
 * Empty because sidebar aliases depend on the consuming application's entrypoints.
 * Generated `.adnbn/sidebar.d.ts` declarations augment `adnbn`, adding discovered aliases as keys with value `true`.
 */
export interface SidebarAliasRegistry {}

export type SidebarAlias = keyof SidebarAliasRegistry extends never
    ? string
    : Extract<keyof SidebarAliasRegistry, string>;

export type SidebarMap = Map<SidebarAlias, ManifestSidebar>;

export interface SidebarConfig {
    icon?: string;
    apply?: boolean;
}

export type SidebarEntrypointOptions = SidebarConfig & CspOptions & ViewOptions;

export type SidebarProps = SidebarEntrypointOptions;

export type SidebarDefinition = SidebarEntrypointOptions & ViewDefinition<SidebarProps>;
