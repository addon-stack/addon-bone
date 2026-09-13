import {createPageAccessRequirements, validateContentStyles} from "./bundler";
import type {ContentScriptEntrypointOptions} from "@typing/content";

describe("validateContentStyles", () => {
    test.each(["panel.content", "panel.relay"])("warns for missing isolated CSS in %s", entry => {
        for (const isolation of [{type: "shadow"}, {type: "iframe"}] as const) {
            const warnings = validateContentStyles(entry, {isolation}, {document: ["host.css"], isolated: []});
            expect(warnings).toHaveLength(1);
            expect(warnings[0]).toContain(`[adnbn:missing-isolation-css] Entrypoint "${entry}"`);
            expect(warnings[0]).toContain("?isolation");
        }
    });

    test.each<ContentScriptEntrypointOptions | undefined>([
        undefined,
        {},
        {isolation: {type: "none"}},
        {isolation: {type: "iframe", page: "panel"}},
        {isolation: {type: "iframe", src: "https://example.com/panel"}},
    ])("does not warn for unrelated entries or embedded documents: %j", options => {
        expect(validateContentStyles("entry", options, {document: ["host.css"], isolated: []})).toEqual([]);
    });

    test("allows entries without CSS and mixed document/isolated styles", () => {
        for (const document of [[], ["host.css"]]) {
            expect(
                validateContentStyles("panel", {isolation: {type: "shadow"}}, {document, isolated: ["ui.css"]})
            ).toEqual([]);
        }
        expect(validateContentStyles("panel", {isolation: {type: "shadow"}}, {document: [], isolated: []})).toEqual([]);
    });

    test.each([{page: "panel"}, {src: "https://example.com/panel"}])(
        "rejects isolated CSS on navigation: %j",
        frame => {
            expect(() =>
                validateContentStyles(
                    "frame",
                    {isolation: {type: "iframe", ...frame}},
                    {document: [], isolated: ["ui.css"]}
                )
            ).toThrow('Entrypoint "frame" uses ?isolation CSS with isolation.page/isolation.src');
        }
    );
});

describe("createPageAccessRequirements", () => {
    test("resolves page aliases from supplied filenames without weakening matches using exclusions", () => {
        const entries = new Map<string, ContentScriptEntrypointOptions>([
            [
                "frame.content",
                {
                    isolation: {type: "iframe", page: "panel"},

                    matches: ["https://*.example.com/*"],
                    excludeMatches: ["https://private.example.com/*"],
                },
            ],
            ["default.relay", {isolation: {type: "iframe", page: "panel"}}],
            ["source.content", {isolation: {type: "iframe", src: "https://example.com/panel"}}],
            ["shadow.content", {isolation: {type: "shadow"}}],
        ]);
        const requirements = createPageAccessRequirements(entries, new Map([["panel", "views/custom-panel.html"]]));
        expect(requirements).toEqual([
            {
                resource: "views/custom-panel.html",
                matches: ["https://*.example.com/*"],
                issuer: 'Content entrypoint "frame.content" embedding page "panel"',
                hint: "add matches to the page or narrow the content matches",
            },
            {
                resource: "views/custom-panel.html",
                matches: ["http://*/*", "https://*/*"],
                issuer: 'Content entrypoint "default.relay" embedding page "panel"',
                hint: "add matches to the page or narrow the content matches",
            },
        ]);
    });

    test("reports an unknown alias with its entrypoint", () => {
        expect(() =>
            createPageAccessRequirements(
                new Map([["frame.content", {isolation: {type: "iframe", page: "missing"}}]]),
                new Map()
            )
        ).toThrow('Content entrypoint "frame.content" references unknown page "missing"');
    });
});
