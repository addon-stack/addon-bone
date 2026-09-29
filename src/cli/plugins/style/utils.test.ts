import fs from "fs";
import path from "path";
import sass from "sass";
import {pathToFileURL} from "url";

import {mergeStyleSources, type StyleSource} from "./utils";

const fixtures = path.resolve(__dirname, "tests", "fixtures");

const readSource = (...parts: string[]): StyleSource => {
    const filename = path.join(fixtures, ...parts);

    return {filename, content: fs.readFileSync(filename, "utf8")};
};

const mergeFixture = (name: string): string =>
    mergeStyleSources(readSource(name, "shared.scss"), readSource(name, "app.scss"));

const mergeLocatedFixture = (name: string): string =>
    mergeStyleSources(readSource(name, "shared", "content.scss"), readSource(name, "app", "content.scss"));

const compileLocatedFixture = (name: string): string =>
    sass.compileString(mergeLocatedFixture(name), {
        url: pathToFileURL(path.join(fixtures, name, "shared", "content.scss")),
    }).css;

const normalizeStyle = (style: string): string => style.replace(/\s+/g, " ").trim();

describe("mergeStyleSources", () => {
    test("moves app Sass module rules before merged style bodies", () => {
        const merged = mergeFixture("module-order");

        expect(merged).toMatchOrder([
            '@use "sass:map";',
            '@use "sass:color";',
            ".badge { color: red; }",
            ".badge { color: blue; }",
        ]);
    });

    test("keeps Sass variable declarations with the module prelude that uses them", () => {
        const merged = mergeFixture("variables");

        expect(merged).toMatchOrder([
            '@use "sass:map";',
            "$accent: blue;",
            '@use "sass:color";',
            ".shared { color: red; }",
            ".app { color: $accent; }",
        ]);
    });

    test("places CSS prelude after Sass module rules from both sources", () => {
        const merged = mergeFixture("css-prelude");

        expect(merged).toMatchOrder([
            '@use "sass:map";',
            '@import url("./reset.css");',
            ".shared { color: red; }",
            ".app { color: blue; }",
        ]);
    });

    test("keeps leading comments in the merged prelude", () => {
        const merged = mergeFixture("comments");

        expect(merged).toMatchOrder([
            "/* shared theme */",
            '@use "sass:map";',
            "/* app theme */",
            '@use "sass:color";',
            ".shared { color: red; }",
            ".app { color: blue; }",
        ]);
    });

    test("keeps block at-rules in the style body", () => {
        const merged = mergeFixture("block-atrules");

        expect(merged).toMatchOrder([
            '@use "sass:map";',
            ".shared { color: red; }",
            "@layer components { .app { color: blue; } }",
        ]);
    });

    test("hoists @charset to the very top of the merged styles", () => {
        const merged = mergeFixture("charset");

        expect(merged).toMatchOrder([
            '@charset "UTF-8";',
            '@use "sass:map";',
            '@use "sass:color";',
            ".shared { color: red; }",
            ".app { color: blue; }",
        ]);
    });

    test("moves @forward into the Sass module prelude", () => {
        const merged = mergeFixture("forward");

        expect(merged).toMatchOrder([
            '@forward "sass:map";',
            '@use "sass:color";',
            ".shared { color: red; }",
            ".app { color: blue; }",
        ]);
    });

    test("treats @namespace as a CSS prelude rule", () => {
        const merged = mergeFixture("namespace");

        expect(merged).toMatchOrder([
            '@use "sass:map";',
            '@namespace svg "svg-ns";',
            ".shared { color: red; }",
            ".app { color: blue; }",
        ]);
    });

    test("hoists @layer statements while keeping @layer blocks in the body", () => {
        const merged = mergeFixture("layer-statement");

        expect(merged).toMatchOrder([
            "@layer extra;",
            "@layer base { .shared { color: red; } }",
            ".app { color: blue; }",
        ]);
    });

    test("collapses identical Sass module rules repeated by an app override", () => {
        const merged = mergeFixture("duplicate-prelude");

        expect(merged.match(/@use "sass:map";/g)).toHaveLength(1);
        expect(() => sass.compileString(merged)).not.toThrow();
    });

    test("keeps conflicting module rules so Sass can still report them", () => {
        const merged = mergeFixture("conflicting-prelude");

        expect(() => sass.compileString(merged)).toThrow(/already a module with namespace "map"/);
    });

    test("does not deduplicate identical style bodies", () => {
        const merged = mergeFixture("duplicate-body");

        expect(normalizeStyle(merged).match(/\.badge \{ color: red; \}/g)).toHaveLength(2);
    });

    test("rebases module requests before merging and preserves Sass configuration and forwarding", () => {
        const merged = mergeLocatedFixture("relative-modules");

        expect(merged).toContain('@use "./theme/tokens" as sharedTokens;');
        expect(merged).toContain('@use "../app/theme/tokens" as appTokens;');
        expect(merged).toContain('@forward "../app/theme/tokens" as theme-* show $theme-accent with ($accent: blue);');
        expect(merged).toContain('@forward "../app/theme/hidden" hide $private;');
        expect(normalizeStyle(merged)).toContain(
            '@use "../app/theme/fonts" with ( $font: url("../app/theme/Inter.woff2?browser&v=a/../b#face") );'
        );

        const css = compileLocatedFixture("relative-modules");

        expect(css).toContain("color: red");
        expect(css).toContain("background: blue");
        expect(css).toContain("font-weight: 400");
        expect(css).toContain('url("../app/theme/Inter.woff2?browser&v=a/../b#face")');
    });

    test("does not deduplicate identical requests to different files or hide their namespace conflict", () => {
        const merged = mergeLocatedFixture("relative-conflict");

        expect(merged).toContain('@use "./theme/tokens";');
        expect(merged).toContain('@use "../app/theme/tokens";');
        expect(() => compileLocatedFixture("relative-conflict")).toThrow(/already a module with namespace "tokens"/);
    });

    test("normalizes shared requests so equivalent relative requests to the same module deduplicate", () => {
        const merged = mergeLocatedFixture("same-module");

        expect(merged).not.toContain("./../common/tokens");
        expect(merged.match(/@use "\.\.\/common\/tokens";/g)).toHaveLength(1);
        expect(compileLocatedFixture("same-module").match(/color: red/g)).toHaveLength(2);
    });

    test("rebases app URLs in declarations and at-rule parameters and leaves shared values and comments as written", () => {
        const merged = normalizeStyle(mergeLocatedFixture("url-values"));

        for (const rebased of [
            '$icon: url("../app/theme/icon.svg");',
            'background: url("../app/theme/plain.svg");',
            '@supports (background: url("../app/theme/support.svg"))',
        ]) {
            expect(merged).toContain(rebased);
        }

        for (const unchanged of [
            "$logo: url(./logo.svg);",
            'background: url("./shared.svg");',
            'content: "url(./text.svg)";',
            '/* url("./comment.svg") */',
        ]) {
            expect(merged).toContain(unchanged);
        }
    });
});

declare global {
    namespace jest {
        interface Matchers<R> {
            toMatchOrder(expected: string[]): R;
        }
    }
}

expect.extend({
    toMatchOrder(received: string, expected: string[]) {
        received = normalizeStyle(received);
        expected = expected.map(normalizeStyle);

        let lastIndex = -1;

        for (const value of expected) {
            const index = received.indexOf(value);

            if (index === -1) {
                return {
                    pass: false,
                    message: () => `Expected merged style to contain ${this.utils.printExpected(value)}.`,
                };
            }

            if (index < lastIndex) {
                return {
                    pass: false,
                    message: () => `Expected ${this.utils.printExpected(value)} to appear after previous style part.`,
                };
            }

            lastIndex = index;
        }

        return {
            pass: true,
            message: () => "Expected merged style parts not to appear in order.",
        };
    },
});
