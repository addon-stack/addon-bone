import {defineTopology, entrypointTopology, mergeTopology, viewTopology} from "./topology";

import {EntrypointEntries, EntrypointFile} from "@typing/entrypoint";
import {TopologyContribution} from "@typing/topology";

// Real fixtures, no mocks: the helpers are pure, and viewTopology only needs an object that
// satisfies the (entries/html/tags) shape — a plain literal is a real implementation, not a stub.

const file = (path: string, imp = `addon/src/${path}`): EntrypointFile => ({file: path, import: imp});

const entries = (...pairs: [string, EntrypointFile[]][]): EntrypointEntries =>
    new Map(pairs.map(([name, files]) => [name, new Set(files)]));

type View = Parameters<typeof viewTopology>[0];

const view = (parts: {entries?: EntrypointEntries; html?: unknown[]; tags?: unknown[]}): View =>
    ({
        entries: async () => parts.entries ?? new Map(),
        html: async () => parts.html ?? [],
        tags: async () => parts.tags ?? [],
    }) as View;

describe("defineTopology", () => {
    it("preserves the constant name verbatim", () => {
        expect(defineTopology({name: "__ADNBN_X__", value: 1}).name).toBe("__ADNBN_X__");
    });

    it("is deterministic for the same value", () => {
        expect(defineTopology({name: "X", value: {a: 1, b: [2, 3]}}).valueHash).toBe(
            defineTopology({name: "X", value: {a: 1, b: [2, 3]}}).valueHash
        );
    });

    it("changes the hash when the value changes", () => {
        expect(defineTopology({name: "X", value: {a: 1}}).valueHash).not.toBe(
            defineTopology({name: "X", value: {a: 2}}).valueHash
        );
    });

    it("does not throw on undefined and is stable (JSON.stringify(undefined) -> 'undefined' fallback)", () => {
        expect(defineTopology({name: "X", value: undefined}).valueHash).toBe(
            defineTopology({name: "X", value: undefined}).valueHash
        );
    });

    it("mirrors the DefinePlugin bake exactly — key order is significant (plain JSON.stringify, not deterministic)", () => {
        // The owning plugin bakes JSON.stringify(value) into the bundle; the snapshot must track
        // that exact string, so a different stringified form (e.g. flipped key order) is a real
        // change to the emitted constant and MUST change the hash.
        expect(defineTopology({name: "X", value: {a: 1, b: 2}}).valueHash).not.toBe(
            defineTopology({name: "X", value: {b: 2, a: 1}}).valueHash
        );
    });
});

describe("entrypointTopology", () => {
    it("maps each entry to its files and virtual-module identity", () => {
        const result = entrypointTopology(entries(["popup", [file("popup/index.tsx")]]));

        expect(result.entries).toEqual([{name: "popup", files: ["popup/index.tsx"]}]);
        expect(result.virtualModules).toEqual([{request: "virtual/popup/index.tsx", sourceFile: "popup/index.tsx"}]);
    });

    it("expands multiple files within one entry", () => {
        const result = entrypointTopology(entries(["background", [file("a.ts"), file("b.ts")]]));

        expect(result.entries).toEqual([{name: "background", files: ["a.ts", "b.ts"]}]);
        expect(result.virtualModules.map(v => v.sourceFile)).toEqual(["a.ts", "b.ts"]);
    });

    it("returns empty slices for no entries", () => {
        expect(entrypointTopology(new Map())).toEqual({entries: [], virtualModules: []});
    });
});

describe("viewTopology", () => {
    it("captures the html filename/title/template baked into HtmlRspackPlugin", async () => {
        const result = await viewTopology(
            view({html: [{chunks: ["popup"], filename: "popup.html", title: "Title", template: "tpl.html"}]})
        );

        expect(result.html).toEqual([{entry: "popup", filename: "popup.html", title: "Title", template: "tpl.html"}]);
    });

    it("passes the provided defines through untouched", async () => {
        const define = defineTopology({name: "__ADNBN_POPUP_MAP__", value: {popup: {path: "popup.html"}}});
        const result = await viewTopology(view({}), [define]);

        expect(result.defines).toEqual([define]);
    });

    describe("htmlTags option whitelist", () => {
        const base = {files: "popup.html", scripts: ["a.js"]};

        it("changes the hash when a whitelisted tag option changes", async () => {
            const a = await viewTopology(view({tags: [{...base, scripts: ["a.js"]}]}));
            const b = await viewTopology(view({tags: [{...base, scripts: ["b.js"]}]}));

            expect(a.htmlTags[0].optionsHash).not.toBe(b.htmlTags[0].optionsHash);
        });

        it("is STABLE when only framework options (csp / matches / readyTimeout) change", async () => {
            // These leak through View.tags() but the plugin ignores them; a manifest-only edit
            // (e.g. csp) must NOT spuriously restart the dev server.
            const a = await viewTopology(
                view({tags: [{...base, csp: {sources: {frame: ["x"]}}, matches: ["<all_urls>"], readyTimeout: 100}]})
            );
            const b = await viewTopology(
                view({
                    tags: [
                        {
                            ...base,
                            csp: {sources: {frame: ["DIFFERENT"]}},
                            matches: ["https://example.com/*"],
                            readyTimeout: 9999,
                        },
                    ],
                })
            );

            expect(a.htmlTags[0].optionsHash).toBe(b.htmlTags[0].optionsHash);
        });

        it("is independent of key order within the tag options", async () => {
            const a = await viewTopology(view({tags: [{files: "p.html", scripts: ["a.js"], links: ["l.css"]}]}));
            const b = await viewTopology(view({tags: [{links: ["l.css"], scripts: ["a.js"], files: "p.html"}]}));

            expect(a.htmlTags[0].optionsHash).toBe(b.htmlTags[0].optionsHash);
        });

        it("captures the target filename from a string or an array of files", async () => {
            const single = await viewTopology(view({tags: [{files: "popup.html"}]}));
            const many = await viewTopology(view({tags: [{files: ["popup.html", "other.html"]}]}));

            expect(single.htmlTags[0].filename).toBe("popup.html");
            expect(many.htmlTags[0].filename).toBe("popup.html");
        });
    });
});

describe("mergeTopology", () => {
    it("returns a fully empty snapshot for no contributions", () => {
        expect(mergeTopology([])).toEqual({entries: [], html: [], htmlTags: [], defines: [], virtualModules: []});
    });

    it("concatenates slices across contributions", () => {
        const merged = mergeTopology([
            {entries: [{name: "a", files: ["a.ts"]}]},
            {entries: [{name: "b", files: ["b.ts"]}]},
        ]);

        expect(merged.entries.map(e => e.name)).toEqual(["a", "b"]);
    });

    it("is order-independent — plugin order must not change the snapshot", () => {
        const a: TopologyContribution = {
            entries: [{name: "popup", files: ["p.ts"]}],
            defines: [{name: "__B__", valueHash: "h2"}],
        };
        const b: TopologyContribution = {
            entries: [{name: "background", files: ["b.ts"]}],
            defines: [{name: "__A__", valueHash: "h1"}],
        };
        const c: TopologyContribution = {virtualModules: [{request: "virtual/x", sourceFile: "x.ts"}]};

        expect(mergeTopology([a, b, c])).toEqual(mergeTopology([c, b, a]));
    });

    it("sorts every slice by its stable key", () => {
        const merged = mergeTopology([
            {
                entries: [{name: "z", files: []}],
                html: [{entry: "z", filename: "z.html"}],
                htmlTags: [{filename: "z.html", optionsHash: "h"}],
                defines: [{name: "__Z__", valueHash: "h"}],
                virtualModules: [{request: "virtual/z", sourceFile: "z"}],
            },
            {
                entries: [{name: "a", files: []}],
                html: [{entry: "a", filename: "a.html"}],
                htmlTags: [{filename: "a.html", optionsHash: "h"}],
                defines: [{name: "__A__", valueHash: "h"}],
                virtualModules: [{request: "virtual/a", sourceFile: "a"}],
            },
        ]);

        expect(merged.entries.map(e => e.name)).toEqual(["a", "z"]);
        expect(merged.html.map(h => h.filename)).toEqual(["a.html", "z.html"]);
        expect(merged.htmlTags.map(h => h.filename)).toEqual(["a.html", "z.html"]);
        expect(merged.defines.map(d => d.name)).toEqual(["__A__", "__Z__"]);
        expect(merged.virtualModules.map(v => v.request)).toEqual(["virtual/a", "virtual/z"]);
    });

    it("keeps duplicates (no dedup) so entry-name collisions stay visible in the snapshot", () => {
        const merged = mergeTopology([
            {entries: [{name: "popup", files: ["a.ts"]}]},
            {entries: [{name: "popup", files: ["b.ts"]}]},
        ]);

        expect(merged.entries).toHaveLength(2);
    });
});
