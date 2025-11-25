import {getContentScriptConfigFromOptions} from "./utils";
import type {ContentScriptEntrypointOptions} from "@typing/content";

describe("content utils - getContentScriptConfigFromOptions", () => {
    test("sorts array fields lexicographically without mutating source arrays", () => {
        const options: ContentScriptEntrypointOptions = {
            matches: ["https://c.com/*", "https://a.com/*", "https://b.com/*"],
            excludeMatches: ["https://z.com/*", "https://x.com/*", "https://y.com/*"],
            includeGlobs: ["**/ccc/*", "**/aaa/*", "**/bbb/*"],
            excludeGlobs: ["**/zzz/*", "**/xxx/*", "**/yyy/*"],
        };

        const original = {
            matches: [...(options.matches as string[])],
            excludeMatches: [...(options.excludeMatches as string[])],
            includeGlobs: [...(options.includeGlobs as string[])],
            excludeGlobs: [...(options.excludeGlobs as string[])],
        };

        const cfg = getContentScriptConfigFromOptions(options);

        expect(cfg.matches).toEqual(["https://a.com/*", "https://b.com/*", "https://c.com/*"]);
        expect(cfg.excludeMatches).toEqual(["https://x.com/*", "https://y.com/*", "https://z.com/*"]);
        expect(cfg.includeGlobs).toEqual(["**/aaa/*", "**/bbb/*", "**/ccc/*"]);
        expect(cfg.excludeGlobs).toEqual(["**/xxx/*", "**/yyy/*", "**/zzz/*"]);

        // should not mutate inputs and should return new array references
        expect(options.matches).toEqual(original.matches);
        expect(options.excludeMatches).toEqual(original.excludeMatches);
        expect(options.includeGlobs).toEqual(original.includeGlobs);
        expect(options.excludeGlobs).toEqual(original.excludeGlobs);

        expect(cfg.matches).not.toBe(options.matches);
        expect(cfg.excludeMatches).not.toBe(options.excludeMatches);
        expect(cfg.includeGlobs).not.toBe(options.includeGlobs);
        expect(cfg.excludeGlobs).not.toBe(options.excludeGlobs);
    });

    test("preserves non-array boolean fields and ignores unknown fields", () => {
        const options = {
            matches: ["https://b.com/*", "https://a.com/*"],
            allFrames: true,
            matchAboutBlank: true,
            matchOriginAsFallback: false,
            unknown: "should be ignored",
            // declarative is part of ContentScriptConfig but must be ignored by picker in this function
            declarative: true,
        } as any as ContentScriptEntrypointOptions;

        const cfg = getContentScriptConfigFromOptions(options);

        // arrays sorted
        expect(cfg.matches).toEqual(["https://a.com/*", "https://b.com/*"]);

        // booleans preserved
        expect(cfg.allFrames).toBe(true);
        expect(cfg.matchAboutBlank).toBe(true);
        expect(cfg.matchOriginAsFallback).toBe(false);

        // unknown field must not exist on result
        expect("unknown" in (cfg as any)).toBe(false);

        // 'declarative' is not picked by the function
        expect("declarative" in (cfg as any)).toBe(false);
        expect((cfg as any).declarative).toBeUndefined();
    });

    test("handles undefined and empty arrays correctly", () => {
        const optionsEmpty: ContentScriptEntrypointOptions = {
            includeGlobs: [],
            excludeGlobs: [],
        };
        const cfgEmpty = getContentScriptConfigFromOptions(optionsEmpty);
        expect(cfgEmpty.includeGlobs).toEqual([]);
        expect(cfgEmpty.excludeGlobs).toEqual([]);
        // toSorted must return new array reference even for empty arrays
        expect(cfgEmpty.includeGlobs).not.toBe(optionsEmpty.includeGlobs);
        expect(cfgEmpty.excludeGlobs).not.toBe(optionsEmpty.excludeGlobs);

        const cfgUndefined = getContentScriptConfigFromOptions({} as ContentScriptEntrypointOptions);
        expect(cfgUndefined.matches).toBeUndefined();
        expect(cfgUndefined.excludeMatches).toBeUndefined();
        expect(cfgUndefined.includeGlobs).toBeUndefined();
        expect(cfgUndefined.excludeGlobs).toBeUndefined();
    });
});
