import type {HtmlRspackPluginOptions} from "@rspack/core";
import type {HtmlTagsPluginOptions} from "@rspackjs/plugin-html-tags";

import {EntrypointPlugin} from "@cli/bundler";
import {hash} from "@cli/utils/hash";

import {EntrypointEntries} from "@typing/entrypoint";
import {
    TopologyContribution,
    TopologyDefine,
    TopologyEntry,
    TopologySnapshot,
    TopologyVirtualModule,
} from "@typing/topology";

interface ViewLike {
    entries(): Promise<EntrypointEntries>;
    html(): Promise<HtmlRspackPluginOptions[]>;
    tags(): Promise<HtmlTagsPluginOptions[]>;
}

type ViewTopologyContribution = Required<
    Pick<TopologyContribution, "entries" | "html" | "htmlTags" | "defines" | "virtualModules">
>;

/**
 * Real HtmlTagsRspackPlugin option keys. `View.tags()` passes through framework/entrypoint
 * options (csp, matches, readyTimeout…) that the plugin simply ignores — but if the snapshot
 * hashed all of them, a manifest-only edit (e.g. csp) would spuriously restart the dev server.
 * Hash ONLY the keys that actually shape the injected tags.
 */
const HTML_TAGS_OPTION_KEYS: ReadonlyArray<keyof HtmlTagsPluginOptions> = [
    "tags",
    "links",
    "scripts",
    "metas",
    "append",
    "prependExternals",
    "jsExtensions",
    "cssExtensions",
    "useHash",
    "addHash",
    "hash",
    "usePublicPath",
    "addPublicPath",
    "publicPath",
];

/**
 * One DefinePlugin constant as a topology entry. The value is hashed exactly as the owning
 * plugin bakes it (`JSON.stringify`), so the hash tracks the real compile-time constant string —
 * change the value and the snapshot changes; the dev server restarts to re-bake it.
 */
export const defineTopology = (define: {name: string; value: unknown}): TopologyDefine => ({
    name: define.name,
    valueHash: hash(JSON.stringify(define.value) ?? "undefined"),
});

/**
 * Topology slice shared by every entrypoint plugin: the entry set and the virtual-module
 * identity (wrapper request ↔ user source). Both derive from discovered {@link EntrypointEntries}.
 */
export const entrypointTopology = (
    entries: EntrypointEntries
): Required<Pick<TopologyContribution, "entries" | "virtualModules">> => {
    const result = {
        entries: [] as TopologyEntry[],
        virtualModules: [] as TopologyVirtualModule[],
    };

    for (const [name, files] of entries) {
        result.entries.push({name, files: Array.from(files, file => file.file)});

        for (const file of files) {
            result.virtualModules.push({request: EntrypointPlugin.filename(file), sourceFile: file.file});
        }
    }

    return result;
};

/**
 * Topology slice for a view-based plugin (popup/page/sidebar/sandbox/offscreen): entries +
 * virtual modules + the HTML pages and tag-injection options, plus any DefinePlugin values the
 * plugin contributes. `title`/`template`/tag options are baked into HtmlRspackPlugin/
 * HtmlTagsRspackPlugin at creation, so changing them requires a restart — hence they belong in
 * the snapshot, not just `filename`.
 */
export const viewTopology = async (
    view: ViewLike,
    defines: TopologyDefine[] = []
): Promise<ViewTopologyContribution> => {
    const {entries, virtualModules} = entrypointTopology(await view.entries());

    const html = (await view.html()).map(options => ({
        entry: Array.isArray(options.chunks) ? String(options.chunks[0] ?? "") : "",
        filename: typeof options.filename === "string" ? options.filename : "",
        title: typeof options.title === "string" ? options.title : undefined,
        template: typeof options.template === "string" ? options.template : undefined,
    }));

    const htmlTags = (await view.tags()).map(options => {
        const source = options as Record<string, unknown>;
        const files = source.files;
        const filename = Array.isArray(files) ? String(files[0] ?? "") : String(files ?? "");

        const tagOptions: Record<string, unknown> = {};

        for (const key of HTML_TAGS_OPTION_KEYS) {
            if (source[key] !== undefined) {
                tagOptions[key] = source[key];
            }
        }

        return {filename, optionsHash: hash(tagOptions)};
    });

    return {entries, html, htmlTags, defines, virtualModules};
};

/**
 * Merge the per-plugin {@link TopologyContribution}s into a single normalized
 * {@link TopologySnapshot}. Pure and order-independent: every array is sorted by a stable key so
 * two runs that discover the same project produce byte-identical snapshots regardless of plugin
 * order — which is what lets the dev server compare snapshots by value to decide on a restart.
 */
export const mergeTopology = (contributions: TopologyContribution[]): TopologySnapshot => {
    const snapshot: TopologySnapshot = {
        entries: [],
        html: [],
        htmlTags: [],
        defines: [],
        virtualModules: [],
    };

    for (const contribution of contributions) {
        snapshot.entries.push(...(contribution.entries ?? []));
        snapshot.html.push(...(contribution.html ?? []));
        snapshot.htmlTags.push(...(contribution.htmlTags ?? []));
        snapshot.defines.push(...(contribution.defines ?? []));
        snapshot.virtualModules.push(...(contribution.virtualModules ?? []));
    }

    snapshot.entries.sort((a, b) => a.name.localeCompare(b.name));
    snapshot.html.sort((a, b) => a.filename.localeCompare(b.filename));
    snapshot.htmlTags.sort((a, b) => a.filename.localeCompare(b.filename));
    snapshot.defines.sort((a, b) => a.name.localeCompare(b.name));
    snapshot.virtualModules.sort((a, b) => a.request.localeCompare(b.request));

    return snapshot;
};
