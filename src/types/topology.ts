/**
 * A framework-owned snapshot of the build's SHAPE — everything baked into the Rspack compiler /
 * its plugins at creation time that cannot be updated on a live compiler. Assembled from the
 * framework's own discovery data via the public `topology` plugin hook (any plugin contributes
 * the slices it owns), NOT by reading Rspack plugin internals.
 *
 * The dev server is the current consumer: it compares snapshots to decide whether the running
 * compiler still matches the project — if the snapshot changed, the compiler is the wrong shape
 * and must be recreated (restart); if not, content edits ride the compiler's own incremental
 * watch / HMR. The snapshot itself is mode-agnostic build-shape data, not a dev-only construct.
 *
 * Identity only — never module CONTENT (render/JSX, CSS, virtual-module bodies). Those change on
 * every save and belong to watch/HMR, not to topology.
 */
export interface TopologyEntry {
    /** Rspack entry (chunk) name. */
    name: string;

    /** Source files that compose the entry. */
    files: string[];
}

export interface TopologyHtml {
    /** Entry the HTML page is generated for. */
    entry: string;

    /** Output HTML filename (affected by the view `as` option). */
    filename: string;

    /** Page title baked into HtmlRspackPlugin at creation. */
    title?: string;

    /** Template path baked into HtmlRspackPlugin at creation. */
    template?: string;
}

export interface TopologyHtmlTags {
    /** HTML file the tags are injected into. */
    filename: string;

    /** Stable hash of the tag-injection options (HtmlTagsRspackPlugin is created with them). */
    optionsHash: string;
}

export interface TopologyDefine {
    /** DefinePlugin constant name (e.g. `__ADNBN_LOCALE_KEYS__`). */
    name: string;

    /** Stable hash of the compile-time value (frozen into the bundle at creation). */
    valueHash: string;
}

export interface TopologyVirtualModule {
    /** Entry/import request used to reference the virtual module. */
    request: string;

    /** User source file the virtual wrapper imports (identity, not content). */
    sourceFile: string;
}

/**
 * One plugin's contribution to the snapshot. Every field is optional — a plugin reports only the
 * slices it owns.
 */
export interface TopologyContribution {
    entries?: TopologyEntry[];
    html?: TopologyHtml[];
    htmlTags?: TopologyHtmlTags[];
    defines?: TopologyDefine[];
    virtualModules?: TopologyVirtualModule[];
}

/** The assembled, normalized snapshot across all plugins. */
export interface TopologySnapshot {
    entries: TopologyEntry[];
    html: TopologyHtml[];
    htmlTags: TopologyHtmlTags[];
    defines: TopologyDefine[];
    virtualModules: TopologyVirtualModule[];
}
