import {ViewDefinition, ViewOptions} from "@typing/view";
import {CspOptions} from "@typing/csp";
import {EntrypointType} from "@typing/entrypoint";

/**
 * Entrypoints that replace a built-in browser page through `chrome_url_overrides`.
 * Chromium refuses to load an extension that overrides more than one page,
 * so each build selects a single override.
 */
export type OverrideEntrypointType = EntrypointType.Newtab | EntrypointType.Bookmarks | EntrypointType.History;

export type OverrideEntrypointOptions = CspOptions & ViewOptions;

export type OverrideProps = OverrideEntrypointOptions;

export type OverrideDefinition = OverrideEntrypointOptions & ViewDefinition<OverrideProps>;

// Newtab
export type NewtabEntrypointOptions = OverrideEntrypointOptions;

export type NewtabProps = NewtabEntrypointOptions;

export type NewtabDefinition = NewtabEntrypointOptions & ViewDefinition<NewtabProps>;

// Bookmarks
export type BookmarksEntrypointOptions = OverrideEntrypointOptions;

export type BookmarksProps = BookmarksEntrypointOptions;

export type BookmarksDefinition = BookmarksEntrypointOptions & ViewDefinition<BookmarksProps>;

// History
export type HistoryEntrypointOptions = OverrideEntrypointOptions;

export type HistoryProps = HistoryEntrypointOptions;

export type HistoryDefinition = HistoryEntrypointOptions & ViewDefinition<HistoryProps>;
