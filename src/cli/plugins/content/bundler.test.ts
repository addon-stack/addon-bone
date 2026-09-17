import {createPageAccessRequirements} from "./bundler";
import type {ContentScriptEntrypointOptions} from "@typing/content";

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
