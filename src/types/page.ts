import {ViewDefinition, ViewOptions} from "@typing/view";
import {CspOptions} from "@typing/csp";
import type {PermissionsOptions} from "@typing/permissions";

/**
 * Empty because page aliases depend on the consuming application's entrypoints.
 * Generated `.adnbn/page.d.ts` declarations augment `adnbn`, adding discovered aliases as keys with value `true`.
 */
export interface PageAliasRegistry {}

export type PageAlias = keyof PageAliasRegistry extends never ? string : Extract<keyof PageAliasRegistry, string>;

export type PageMap = Map<PageAlias, string>;

export interface PageConfig {
    name?: string;
    matches?: string[];
}

/**
 * Each page included in a build contributes its permissions and CSP to the extension manifest,
 * even if the page is never opened. Permissions and CSP apply to the extension, not just this page.
 */
export type PageEntrypointOptions = PageConfig & PermissionsOptions & CspOptions & ViewOptions;

export type PageProps = PageEntrypointOptions;

export type PageDefinition = PageEntrypointOptions & ViewDefinition<PageProps>;
