import fs from "fs";
import path from "path";
import sass from "sass";
import {pathToFileURL} from "url";

import {prepareStyleSources} from "./prepare-style-sources";
import type {StyleSource} from "./types";

const fixtures = path.resolve(__dirname, "tests", "fixtures");

const readSource = (...parts: string[]): StyleSource => {
    const filename = path.join(fixtures, ...parts);

    return {filename, content: fs.readFileSync(filename, "utf8")};
};

const mergeFixture = (name: string): string => {
    const shared = readSource(name, "shared.scss");

    return prepareStyleSources([shared, readSource(name, "app.scss")], shared.filename);
};

const mergeLocatedFixture = (name: string): string => {
    const shared = readSource(name, "shared", "content.scss");

    return prepareStyleSources([shared, readSource(name, "app", "content.scss")], shared.filename);
};

const compileLocatedFixture = (name: string): string =>
    compile(mergeLocatedFixture(name), path.join(fixtures, name, "shared", "content.scss"));

const compile = (content: string, filename = path.join(fixtures, "virtual.scss")): string => {
    return sass.compileString(content, {
        url: pathToFileURL(filename),
        // A load path enables Sass's filesystem importer when compiling an in-memory source.
        loadPaths: [fixtures],
        silenceDeprecations: ["import"],
    }).css;
};

const moduleUrl = (...parts: string[]): string => pathToFileURL(path.join(fixtures, ...parts)).href;
const resourcePath = (...parts: string[]): string =>
    path
        .join(fixtures, ...parts)
        .split(path.sep)
        .join("/");

const normalizeStyle = (style: string): string => style.replace(/\s+/g, " ").trim();

describe("prepareStyleSources", () => {
    test("accepts an absent theme", () => {
        expect(prepareStyleSources([], path.join(fixtures, "virtual.scss"))).toBe("");
    });

    test("prepares a single source compiled under its own filename", () => {
        const source = readSource("url-values", "shared", "content.scss");
        const prepared = prepareStyleSources([source], source.filename);

        expect(prepared).toContain(`url("${resourcePath("url-values", "shared", "logo.svg")}")`);
        expect(prepared).toContain(`url("${resourcePath("url-values", "shared", "shared.svg")}")`);
    });

    test("reports bare module dependencies from every original source", () => {
        const shared = readSource("bare-local", "shared", "content.scss");
        const app = readSource("bare-local", "app", "content.scss");
        const dependencies = new Map<string, boolean>();

        prepareStyleSources([shared, app], shared.filename, (filename, exists) => {
            dependencies.set(filename, exists);
        });

        expect(dependencies.get(path.join(path.dirname(shared.filename), "_tokens.v2.scss"))).toBe(true);
        expect(dependencies.get(path.join(path.dirname(app.filename), "_tokens.v2.scss"))).toBe(true);
        expect(dependencies.get(path.join(path.dirname(app.filename), "indexed", "_index.scss"))).toBe(true);
        expect(dependencies.get(path.join(path.dirname(app.filename), "_legacy.import.scss"))).toBe(true);
        expect(dependencies.get(path.join(path.dirname(app.filename), "tokens.v2.scss"))).toBe(false);
        expect(dependencies.get(path.join(path.dirname(shared.filename), "tokens.v2", "_index.scss"))).toBe(false);
    });

    test("preserves cascade order for more than two sources", () => {
        const prepared = prepareStyleSources(
            ["first.scss", "second.scss", "third.scss"].map(name => readSource("multiple-sources", name)),
            path.join(fixtures, "virtual.scss")
        );

        expect(compile(prepared)).toMatchOrder(["width: 3px", "width: 4px", "width: 5px"]);
        expect(prepared.match(/@use "sass:math";/g)).toHaveLength(1);
    });

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
            `@import url("${resourcePath("css-prelude", "reset.css")}");`,
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

    test("preserves repeated variable assignments across sources", () => {
        expect(compile(mergeFixture("preserved-variables"))).toContain("color: red");
    });

    test("keeps configured loads so Sass reports repeated configuration", () => {
        const prepared = mergeFixture("configured-repeat");

        expect(prepared.match(/@use /g)).toHaveLength(2);
        expect(() => compile(prepared)).toThrow(/already loaded/);
    });

    test("does not hide duplicate modules within one source behind a previous source", () => {
        const prepared = mergeFixture("same-source-duplicate");

        expect(prepared.match(/@use "sass:math";/g)).toHaveLength(3);
        expect(() => compile(prepared)).toThrow(/already a module with namespace "math"/);
    });

    test("retains CSS import and layer effects from both sources", () => {
        const prepared = mergeFixture("css-effects");

        expect(prepared.match(/@import /g)).toHaveLength(2);
        expect(prepared.match(/@layer base, app;/g)).toHaveLength(2);
        expect(prepared.lastIndexOf("@import")).toBeLessThan(prepared.indexOf(".shared"));
        expect(prepared.indexOf("@use")).toBeLessThan(prepared.indexOf("@layer"));
    });

    test.each(["body-use.scss", "import-use.scss", "layer-forward.scss", "empty-block-use.scss"])(
        "reports late module rules in %s against their original source location",
        filename => {
            const source = readSource("invalid-order", filename);

            expect(() => prepareStyleSources([source], path.join(fixtures, "virtual.scss"))).toThrow(
                `${source.filename}:2:1`
            );
        }
    );

    test("keeps shared Sass variables and mixins available to the app body", () => {
        const css = compile(mergeFixture("shared-scope"));

        expect(css).toContain("color: blue");
        expect(css).toContain("padding: 11px");
        expect(css.indexOf(".shared")).toBeLessThan(css.indexOf(".app"));
    });

    test("resolves bare local dotted modules, indexes, CSS modules and import-only partials", () => {
        const css = compileLocatedFixture("bare-local");

        expect(css).toContain("color: red");
        expect(css).toContain("color: blue");
        expect(css).toContain("width: 17px");
        expect(css).toContain("height: 23px");
        expect(css).toContain(".plain");
    });

    test("leaves import-only index lookup to Sass", () => {
        const source = readSource("bare-local", "import-index.scss");

        expect(compile(prepareStyleSources([source], path.join(fixtures, "virtual.scss")))).toContain("width: 29px");
    });

    test("resolves module files from source directories containing spaces and URL-reserved characters", () => {
        const source = readSource("path with spaces#percent%", "content.scss");

        expect(compile(prepareStyleSources([source], path.join(fixtures, "virtual.scss")))).toContain("color: orange");
    });

    test("resolves escaped module strings as Sass does before source preparation", () => {
        const source = readSource("escaped-modules", "content.scss");
        const original = compile(source.content, source.filename);
        const prepared = compile(prepareStyleSources([source], path.join(fixtures, "virtual.scss")));

        expect(prepared).toBe(original);
        expect(prepared).toContain("color: orange");
        expect(prepared).toContain("width: 17px");
        expect(prepared).toContain("height: 23px");
        expect(prepared).toContain("margin: 29px");
        expect(prepared).toContain("padding: 50px");
    });

    test("leaves ambiguous local partials to Sass", () => {
        const source = readSource("ambiguous", "content.scss");

        expect(() => compile(prepareStyleSources([source], path.join(fixtures, "virtual.scss")))).toThrow(
            /not clear which file to import/
        );
    });

    test("rebases module requests before merging and preserves Sass configuration and forwarding", () => {
        const merged = mergeLocatedFixture("relative-modules");

        expect(merged).toContain(
            `@use "${moduleUrl("relative-modules", "shared", "theme", "tokens")}" as sharedTokens;`
        );
        expect(merged).toContain(`@use "${moduleUrl("relative-modules", "app", "theme", "tokens")}" as appTokens;`);
        expect(merged).toContain(
            `@forward "${moduleUrl("relative-modules", "app", "theme", "tokens")}" as theme-* show $theme-accent with ($accent: blue);`
        );
        expect(merged).toContain(
            `@forward "${moduleUrl("relative-modules", "app", "theme", "hidden")}" hide $private;`
        );
        expect(normalizeStyle(merged)).toContain(
            `@use "${moduleUrl("relative-modules", "app", "theme", "fonts")}" with ( $font: url("${resourcePath("relative-modules", "app", "theme", "Inter.woff2")}?browser&v=a/../b#face") );`
        );

        const css = compileLocatedFixture("relative-modules");

        expect(css).toContain("color: red");
        expect(css).toContain("background: blue");
        expect(css).toContain("font-weight: 400");
        expect(css).toContain(
            `url("${resourcePath("relative-modules", "app", "theme", "Inter.woff2")}?browser&v=a/../b#face")`
        );
    });

    test("does not deduplicate identical requests to different files or hide their namespace conflict", () => {
        const merged = mergeLocatedFixture("relative-conflict");

        expect(merged).toContain(`@use "${moduleUrl("relative-conflict", "shared", "theme", "tokens")}";`);
        expect(merged).toContain(`@use "${moduleUrl("relative-conflict", "app", "theme", "tokens")}";`);
        expect(() => compileLocatedFixture("relative-conflict")).toThrow(/already a module with namespace "tokens"/);
    });

    test("normalizes shared requests so equivalent relative requests to the same module deduplicate", () => {
        const merged = mergeLocatedFixture("same-module");

        expect(merged).not.toContain("./../common/tokens");
        expect(merged.split(`@use "${moduleUrl("same-module", "common", "tokens")}";`)).toHaveLength(2);
        expect(compileLocatedFixture("same-module").match(/color: red/g)).toHaveLength(2);
    });

    test("prepares both source URLs in declarations and at-rule parameters while keeping text and comments", () => {
        const merged = normalizeStyle(mergeLocatedFixture("url-values"));

        for (const rebased of [
            `$icon: url("${resourcePath("url-values", "app", "theme", "icon.svg")}");`,
            `background: url("${resourcePath("url-values", "app", "theme", "plain.svg")}");`,
            `@supports (background: url("${resourcePath("url-values", "app", "theme", "support.svg")}"))`,
            `$logo: url("${resourcePath("url-values", "shared", "logo.svg")}");`,
            `background: url("${resourcePath("url-values", "shared", "shared.svg")}");`,
        ]) {
            expect(merged).toContain(rebased);
        }

        for (const unchanged of ['content: "url(./text.svg)";', '/* url("./comment.svg") */']) {
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
