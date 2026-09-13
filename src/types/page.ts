import {ViewDefinition, ViewOptions} from "@typing/view";
import {CspOptions} from "@typing/csp";

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

export type PageEntrypointOptions = PageConfig & CspOptions & ViewOptions;

export type PageProps = PageEntrypointOptions;

export type PageDefinition = PageEntrypointOptions & ViewDefinition<PageProps>;
