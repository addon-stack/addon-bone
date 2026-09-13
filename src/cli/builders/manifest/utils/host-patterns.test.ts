import {filterHostPatterns} from "./host-patterns";

const toSet = (arr: string[]) => new Set(arr);
const setToArray = (set: Set<string>) => Array.from(set);

describe("filterHostPatterns", () => {
    test.each([
        ["https://*.example.com/*", "https://sub.example.com/file.json"],
        ["https://*.example.com/*", "https://example.com/file.json"],
        ["https://*.example.com/*", "https://nested.sub.example.com/file.json"],
        ["https://*.example.com/*", "https://*.sub.example.com/path/*"],
        ["https://sub.example.com/*", "https://sub.example.com/file.json"],
        ["https://*.example.com/path/*", "https://sub.example.com/path/file.json"],
        ["https://*.example.com/path/*", "https://sub.example.com/path/nested/*"],
        ["https://*.example.com/*/file*.json", "https://sub.example.com/nested/file-a.json"],
        ["*://*.example.com/*", "http://sub.example.com/file.json"],
        ["*://*.example.com/*", "https://sub.example.com/file.json"],
        ["*://*.example.com/*", "*://sub.example.com/path/*"],
        ["https://*/path/*", "https://sub.example.com/path/file.json"],
        ["file:///*", "file:///path/file.json"],
    ])("%s covers %s regardless of input order", (covering, covered) => {
        expect(filterHostPatterns(toSet([covered, covering]))).toEqual(toSet([covering]));
        expect(filterHostPatterns(toSet([covering, covered]))).toEqual(toSet([covering]));
    });

    test.each([
        ["https://*.sub.example.com/*", "https://notsub.example.com/file.json"],
        ["https://*.example.com/*", "https://example.com.example.org/file.json"],
        ["https://sub.example.com/*", "https://example.com/file.json"],
        ["https://sub.example.com/*", "https://nested.sub.example.com/file.json"],
        ["https://*.example.com/*", "http://sub.example.com/file.json"],
        ["https://*.example.com/*", "*://sub.example.com/file.json"],
        ["*://*.example.com/*", "ftp://sub.example.com/file.json"],
        ["*://*.example.com/*", "ws://sub.example.com/*"],
        ["*://*.example.com/*", "wss://sub.example.com/*"],
        ["https://*.example.com/path/*", "https://sub.example.com/other/file.json"],
        ["https://*.example.com/path/*", "https://sub.example.com/*"],
        ["https://*.example.com/file.json?key=*", "https://sub.example.com/fileXjson?key=value"],
        ["https://*.example.com/*/file.json", "https://sub.example.com/*/file.json*"],
        ["chrome-extension://*/*", "chrome-extension://extension-id/page.html"],
        ["custom://*/*", "custom://sub.example.com/file.json"],
    ])("preserves patterns without full coverage: %s and %s", (first, second) => {
        const input = toSet([first, second]);

        expect(filterHostPatterns(input)).toEqual(input);
    });

    test("keeps one equivalent pattern and does not mutate the input", () => {
        const input = toSet(["https://example.com/**", "https://example.com/*"]);

        expect(filterHostPatterns(input)).toEqual(toSet(["https://example.com/**"]));
        expect(setToArray(input)).toEqual(["https://example.com/**", "https://example.com/*"]);
        expect(filterHostPatterns(new Set())).toEqual(new Set());
    });

    test("returns only <all_urls> when present", () => {
        const input = toSet(["<all_urls>", "https://*/*", "http://example.com/*", "chrome-extension://*/*"]);

        const result = filterHostPatterns(input);

        expect(setToArray(result).sort()).toEqual(["<all_urls>"]);
    });

    test("handles *://*/* covering http and https but not special or other schemes", () => {
        const input = toSet([
            "*://*/*",
            "http://*/*",
            "https://*/*",
            "https://example.com/*",
            "http://another.example/*",
            "file://*/*",
            "file://Downloads/*",
            "chrome-extension://*/*",
        ]);

        const result = filterHostPatterns(input);

        expect(new Set(result)).toEqual(toSet(["*://*/*", "file://*/*", "chrome-extension://*/*"]));
    });

    test("http wildcard covers only http; https specifics remain", () => {
        const input = toSet(["http://*/*", "http://example.com/*", "https://example.com/*"]);

        const result = filterHostPatterns(input);

        expect(new Set(result)).toEqual(toSet(["http://*/*", "https://example.com/*"]));
    });

    test("both http and https wildcards present; ftp specific remains", () => {
        const input = toSet([
            "http://*/*",
            "https://*/*",
            "https://site.example.com/*",
            "http://site.example.com/*",
            "ftp://example.com/*",
        ]);

        const result = filterHostPatterns(input);

        expect(new Set(result)).toEqual(toSet(["http://*/*", "https://*/*", "ftp://example.com/*"]));
    });

    test("special schemes are never considered covered by *://*/*", () => {
        const input = toSet([
            "*://*/*",
            "chrome-extension://*/*",
            "moz-extension://*/*",
            "data://*/*",
            "blob://*/*",
            "filesystem://*/*",
            "about://*/*",
            "chrome://*/*",
            "resource://*/*",
        ]);

        const result = filterHostPatterns(input);

        expect(new Set(result)).toEqual(
            toSet([
                "*://*/*",
                "chrome-extension://*/*",
                "moz-extension://*/*",
                "data://*/*",
                "blob://*/*",
                "filesystem://*/*",
                "about://*/*",
                "chrome://*/*",
                "resource://*/*",
            ])
        );
    });
});
