import path from "node:path";
import {pathToFileURL} from "node:url";

import {prepareModuleRequests, prepareUrlFunctions} from "./style-paths";

const source = path.resolve("src");
const from = path.join(source, "apps", "alpha", "content", "content.scss");
const directory = path.dirname(from).split(path.sep).join("/");
const moduleUrl = (request: string): string => pathToFileURL(path.resolve(path.dirname(from), request)).href;
const fixtures = path.resolve(__dirname, "tests", "fixtures");

describe("prepareModuleRequests", () => {
    test.each(["tokens", "./tokens"])("reports every candidate for %s even after finding a stylesheet", request => {
        const filename = path.join(fixtures, "ambiguous", "content.scss");
        const dependencies = new Map<string, boolean>();

        prepareModuleRequests(`"${request}"`, filename, false, (candidate, exists) => {
            dependencies.set(candidate, exists);
        });

        expect(dependencies).toEqual(
            new Map([
                [path.join(fixtures, "ambiguous", "tokens.scss"), true],
                [path.join(fixtures, "ambiguous", "_tokens.scss"), true],
                [path.join(fixtures, "ambiguous", "tokens", "index.scss"), false],
                [path.join(fixtures, "ambiguous", "tokens", "_index.scss"), false],
                [path.join(fixtures, "ambiguous", "tokens.sass"), false],
                [path.join(fixtures, "ambiguous", "_tokens.sass"), false],
                [path.join(fixtures, "ambiguous", "tokens", "index.sass"), false],
                [path.join(fixtures, "ambiguous", "tokens", "_index.sass"), false],
                [path.join(fixtures, "ambiguous", "tokens.css"), false],
                [path.join(fixtures, "ambiguous", "_tokens.css"), false],
                [path.join(fixtures, "ambiguous", "tokens", "index.css"), false],
                [path.join(fixtures, "ambiguous", "tokens", "_index.css"), false],
            ])
        );
    });

    test("reports missing bare candidates without changing package fallback", () => {
        const filename = path.join(fixtures, "bare-local", "app", "content.scss");
        const dependencies = new Map<string, boolean>();

        const prepared = prepareModuleRequests('"absent-theme"', filename, false, (candidate, exists) => {
            dependencies.set(candidate, exists);
        });

        expect(prepared).toBe('"absent-theme"');
        expect(dependencies.size).toBe(12);
        expect([...dependencies.values()]).toEqual(Array(12).fill(false));
        expect(dependencies.has(path.join(path.dirname(filename), "_absent-theme.scss"))).toBe(true);
        expect(dependencies.has(path.join(path.dirname(filename), "absent-theme", "_index.scss"))).toBe(true);
    });

    test("reports existing import-only files and missing alternatives", () => {
        const filename = path.join(fixtures, "bare-local", "app", "content.scss");
        const dependencies = new Map<string, boolean>();

        prepareModuleRequests('"legacy"', filename, true, (candidate, exists) => {
            dependencies.set(candidate, exists);
        });

        expect(dependencies.size).toBe(24);
        expect(dependencies.get(path.join(path.dirname(filename), "_legacy.import.scss"))).toBe(true);
        expect(dependencies.get(path.join(path.dirname(filename), "legacy", "_index.import.scss"))).toBe(false);
        expect(dependencies.get(path.join(path.dirname(filename), "_legacy.scss"))).toBe(false);
    });

    test.each(["./absent-theme", "../theme/absent-fonts"])(
        "reports missing candidates for %s while retaining its source-relative request",
        request => {
            const dependencies = new Map<string, boolean>();
            const prepared = prepareModuleRequests(`"${request}"`, from, false, (candidate, exists) => {
                dependencies.set(candidate, exists);
            });
            const filename = path.resolve(path.dirname(from), request);

            expect(prepared).toBe(`"${moduleUrl(request)}"`);
            expect(dependencies.size).toBe(12);
            expect([...dependencies.values()]).toEqual(Array(12).fill(false));
            expect(dependencies.has(path.join(path.dirname(filename), "_" + path.basename(filename) + ".scss"))).toBe(
                true
            );
            expect(dependencies.has(path.join(filename, "_index.scss"))).toBe(true);
        }
    );

    test.each(['"sass:math"', '"@theme/tokens"', '"theme.css"'])(
        "leaves dependency ownership for %s with its existing resolver",
        params => {
            const dependencies = new Map<string, boolean>();

            prepareModuleRequests(params, from, true, (candidate, exists) => {
                dependencies.set(candidate, exists);
            });

            expect(dependencies.size).toBe(0);
        }
    );

    test.each([
        ['"./theme/tokens" as appTokens', `"${moduleUrl("./theme/tokens")}" as appTokens`],
        ["'../theme/fonts'", `'${moduleUrl("../theme/fonts")}'`],
        [
            '"./theme/tokens" as theme-* show $theme-accent with ($accent: blue)',
            `"${moduleUrl("./theme/tokens")}" as theme-* show $theme-accent with ($accent: blue)`,
        ],
        [
            '"../theme/fonts" with (\n  $font: url("../theme/font.woff2?browser")\n)',
            `"${moduleUrl("../theme/fonts")}" with (\n  $font: url("../theme/font.woff2?browser")\n)`,
        ],
        ['/* app */ "./theme/tokens"', `/* app */ "${moduleUrl("./theme/tokens")}"`],
        ['"./theme/./tokens"', `"${moduleUrl("./theme/tokens")}"`],
        ['"./space\\ name"', `"${moduleUrl("./space name")}"`],
        ['"./space\\20 name"', `"${moduleUrl("./space name")}"`],
        ['"./space\\000020name"', `"${moduleUrl("./space name")}"`],
        ['"./space%20name"', `"${moduleUrl("./space name")}"`],
        ['"./50%off"', `"${moduleUrl("./50%off")}"`],
        ['"./50%25off"', `"${moduleUrl("./50%off")}"`],
        ['"./\\74 okens"', `"${moduleUrl("./tokens")}"`],
    ])("prepares the relative request in %j", (params, expected) => {
        expect(prepareModuleRequests(params, from)).toBe(expected);
    });

    test.each([
        '"sass:math"',
        '"some-package/theme"',
        '"@theme/tokens"',
        '"~theme/tokens"',
        '"theme/tokens"',
        '"pkg:some-package"',
        '"./#{$theme}"',
        '"./theme/tokens',
        "",
    ])("keeps %j as written", params => {
        expect(prepareModuleRequests(params, from)).toBe(params);
    });

    test("uses encoded file URLs for module paths with spaces and URL-reserved characters", () => {
        const filename = path.resolve("project with spaces", "theme#one%", "content.scss");
        const expected = pathToFileURL(path.resolve(path.dirname(filename), "fonts")).href;

        expect(prepareModuleRequests('"./fonts"', filename)).toBe(`"${expected}"`);
        expect(expected).toContain("project%20with%20spaces/theme%23one%25/fonts");
    });

    test.each(["'", '"'])("escapes %s introduced by the source directory", quote => {
        const filename = path.resolve(`author${quote}s project`, "content.scss");
        const expected = pathToFileURL(path.resolve(path.dirname(filename), "fonts")).href.replaceAll(
            quote,
            `\\${quote}`
        );

        expect(prepareModuleRequests(`${quote}./fonts${quote}`, filename)).toBe(`${quote}${expected}${quote}`);
    });

    test.each(["'", '"'])("escapes %s in quoted CSS imports", quote => {
        const filename = path.resolve(`author${quote}s project`, "content.scss");
        const expected = path.dirname(filename).split(path.sep).join("/").replaceAll(quote, `\\${quote}`);

        expect(prepareModuleRequests(`${quote}./theme.css${quote}`, filename, true)).toBe(
            `${quote}${expected}/theme.css${quote}`
        );
    });

    test("prepares all legacy Sass import requests, keeping CSS imports as filesystem requests", () => {
        expect(prepareModuleRequests('"./one", "../two", "./base.css?theme=1#part"', from, true)).toBe(
            `"${moduleUrl("./one")}", "${moduleUrl("../two")}", "${directory}/base.css?theme=1#part"`
        );
    });

    test.each([
        ['"./screen" screen', `"${directory}/screen" screen`],
        ['"./screen" layer(theme)', `"${directory}/screen" layer(theme)`],
        ['"./screen" supports(display: grid)', `"${directory}/screen" supports(display: grid)`],
        ['url("./screen.css")', 'url("./screen.css")'],
        ['"https://example.com/theme.css"', '"https://example.com/theme.css"'],
        ['"@theme/base.css"', '"@theme/base.css"'],
    ])("preserves CSS import behavior for %j", (params, expected) => {
        expect(prepareModuleRequests(params, from, true)).toBe(expected);
    });
});

describe("prepareUrlFunctions", () => {
    test.each([
        ["url(theme/plain.svg)", `url("${directory}/theme/plain.svg")`],
        [
            'url( "./theme/spaced font.woff2?browser#face" )',
            `url( "${directory}/theme/spaced font.woff2?browser#face" )`,
        ],
        ["url('./theme/icon.svg?next=a/../b#face')", `url('${directory}/theme/icon.svg?next=a/../b#face')`],
        ['url("./theme/escaped\\ name.svg")', `url("${directory}/theme/escaped name.svg")`],
        ['url("./theme/escaped\\20 name.svg")', `url("${directory}/theme/escaped name.svg")`],
        ['URL("../theme/upper.svg")', `URL("${path.posix.join(directory, "../theme/upper.svg")}")`],
        ['url("./theme/font.woff2") format("woff2")', `url("${directory}/theme/font.woff2") format("woff2")`],
        ['url("./a.svg"), url("./b.svg")', `url("${directory}/a.svg"), url("${directory}/b.svg")`],
        [
            'image-set(url("./a.png") 1x, url("./a@2x.png") 2x)',
            `image-set(url("${directory}/a.png") 1x, url("${directory}/a@2x.png") 2x)`,
        ],
        [
            '(\n  $font: url("../theme/font.woff2?browser")\n)',
            `(\n  $font: url("${path.posix.join(directory, "../theme/font.woff2")}?browser")\n)`,
        ],
    ])("prepares the literal URL in %j", (value, expected) => {
        expect(prepareUrlFunctions(value, from)).toBe(expected);
    });

    test.each([
        'url("https://example.com/font.woff2")',
        'url("//example.com/font.woff2")',
        'url("data:image/svg+xml;base64,AAAA")',
        'url("chrome-extension://id/font.woff2")',
        'url("/font.woff2")',
        'url("#icon")',
        'url("?version=1")',
        'url("~package/font.woff2")',
        'url("@theme/font.woff2")',
        "url($font)",
        'url("#{$directory}/font.woff2")',
        "url(./#{$theme}.svg)",
        "url(font-path())",
        'url("./a.svg" "b")',
        'url("./unclosed',
        "url()",
        '"url(./text.svg)"',
        '$font format("woff2")',
    ])("keeps %j as written", value => {
        expect(prepareUrlFunctions(value, from)).toBe(value);
    });

    test("can prepare already prepared URLs again without changing their origin", () => {
        const prepared = prepareUrlFunctions('url("./font.woff2?browser#face")', from);

        expect(prepareUrlFunctions(prepared, path.join(source, "virtual.scss"))).toBe(prepared);
    });

    test.each(["'", '"'])("escapes %s from the source directory in literal URLs", quote => {
        const filename = path.resolve(`author${quote}s project`, "content.scss");
        const directory = path.dirname(filename).split(path.sep).join("/").replaceAll(quote, `\\${quote}`);

        expect(prepareUrlFunctions(`url(${quote}./font.woff2${quote})`, filename)).toBe(
            `url(${quote}${directory}/font.woff2${quote})`
        );
    });
});
