import path from "path";

import {rebaseModuleRequest, rebaseUrlFunctions} from "./rebase";

const source = path.resolve("src");
const from = path.join(source, "apps", "alpha", "content", "content.scss");
const to = path.join(source, "shared", "content", "content.scss");

describe("rebaseModuleRequest", () => {
    test.each([
        ['"./theme/tokens" as appTokens', '"../../apps/alpha/content/theme/tokens" as appTokens'],
        ["'../theme/fonts'", "'../../apps/alpha/theme/fonts'"],
        [
            '"./theme/tokens" as theme-* show $theme-accent with ($accent: blue)',
            '"../../apps/alpha/content/theme/tokens" as theme-* show $theme-accent with ($accent: blue)',
        ],
        [
            '"../theme/fonts" with (\n  $font: url("../theme/font.woff2?browser")\n)',
            '"../../apps/alpha/theme/fonts" with (\n  $font: url("../theme/font.woff2?browser")\n)',
        ],
        ['/* app */ "./theme/tokens"', '/* app */ "../../apps/alpha/content/theme/tokens"'],
    ])("rebases the relative request in %j", (params, expected) => {
        expect(rebaseModuleRequest(params, from, to)).toBe(expected);
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
        expect(rebaseModuleRequest(params, from, to)).toBe(params);
    });

    test.each([
        ['"./../common/tokens"', '"../common/tokens"'],
        ['"./theme/./tokens" as tokens', '"./theme/tokens" as tokens'],
        ['"../common/tokens"', '"../common/tokens"'],
        ['"theme/tokens"', '"theme/tokens"'],
    ])("normalizes %j for the same stylesheet", (params, expected) => {
        expect(rebaseModuleRequest(params, to, to)).toBe(expected);
    });
});

describe("rebaseUrlFunctions", () => {
    test.each([
        ["url(theme/plain.svg)", 'url("../../apps/alpha/content/theme/plain.svg")'],
        [
            'url( "./theme/spaced font.woff2?browser#face" )',
            'url( "../../apps/alpha/content/theme/spaced font.woff2?browser#face" )',
        ],
        ["url('./theme/icon.svg?next=a/../b#face')", "url('../../apps/alpha/content/theme/icon.svg?next=a/../b#face')"],
        ['url("./theme/escaped\\ name.svg")', 'url("../../apps/alpha/content/theme/escaped\\ name.svg")'],
        ['URL("../theme/upper.svg")', 'URL("../../apps/alpha/theme/upper.svg")'],
        [
            'url("./theme/font.woff2") format("woff2")',
            'url("../../apps/alpha/content/theme/font.woff2") format("woff2")',
        ],
        [
            'url("./a.svg"), url("./b.svg")',
            'url("../../apps/alpha/content/a.svg"), url("../../apps/alpha/content/b.svg")',
        ],
        [
            'image-set(url("./a.png") 1x, url("./a@2x.png") 2x)',
            'image-set(url("../../apps/alpha/content/a.png") 1x, url("../../apps/alpha/content/a@2x.png") 2x)',
        ],
        [
            '(\n  $font: url("../theme/font.woff2?browser")\n)',
            '(\n  $font: url("../../apps/alpha/theme/font.woff2?browser")\n)',
        ],
    ])("rebases the literal URL in %j", (value, expected) => {
        expect(rebaseUrlFunctions(value, from, to)).toBe(expected);
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
        expect(rebaseUrlFunctions(value, from, to)).toBe(value);
    });
});
