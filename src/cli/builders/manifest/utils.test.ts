import {filterHostPatterns, mergeWebAccessibleResources} from "./utils";

import {ManifestAccessibleResource} from "@typing/manifest";

const toSet = (arr: string[]) => new Set(arr);
const setToArray = (set: Set<string>) => Array.from(set);
const sortResources = (resources: ManifestAccessibleResource[]): ManifestAccessibleResource[] => {
    return resources.map((r) => {
        const result: ManifestAccessibleResource = {resources: r.resources};

        if (r.matches) result.matches = r.matches.sort();
        if (r.extensionIds) result.extensionIds = r.extensionIds.sort();
        if (r.useDynamicUrl !== undefined) result.useDynamicUrl = r.useDynamicUrl;

        return result;
    });
};

describe("filterHostPatterns", () => {
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
            "https://site.com/*",
            "http://site.com/*",
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

describe("mergeWebAccessibleResources", () => {
    test("merge resources with same matches without duplicates", () => {
        const input = [
            {
                "resources": ["a.js", "b.js"],
                "matches": ["https://example.com/*"]
            },
            {
                "resources": ["b.js", "c.js"],
                "matches": ["https://example.com/*"]
            },
            {
                "resources": ["c.js", "d.js"],
                "matches": ["https://example.com/*"]
            }
        ];

        expect(sortResources(mergeWebAccessibleResources(input)))
            .toEqual(sortResources([
                {
                    resources: ["a.js", "b.js", "c.js", "d.js"],
                    matches: ["https://example.com/*"]
                }
            ]));
    });

    test("remove unnecessary matches in one element", () => {
        const input_1 = [
            {
                "resources": ["a.js"],
                "matches": ["<all_urls>", "https://example.com/*"]
            }
        ];

        const input_2 = [
            {
                "resources": ["a.js"],
                "matches": ["*://*/*", "https://example.com/*"]
            }
        ];

        expect(sortResources(mergeWebAccessibleResources(input_1)))
            .toEqual(sortResources([
                {
                    resources: ["a.js"],
                    matches: ["<all_urls>"]
                }
            ]));

        expect(sortResources(mergeWebAccessibleResources(input_2)))
            .toEqual(sortResources([
                {
                    resources: ["a.js"],
                    matches: ["*://*/*"]
                }
            ]));
    });

    test("remove resources from other elements if they exist in the element with <all_urls> or *://*/* pattern", () => {
        const input = [
            {
                "resources": ["a.js"],
                "matches": ["<all_urls>"]
            },
            {
                "resources": ["b.js"],
                "matches": ["*://*/*"]
            },
            {
                "resources": ["a.js", "b.js"],
                "matches": ["https://example.com/*"]
            },
            {
                "resources": ["a.js", "b.js", 'c.js'],
                "matches": ["https://google.com/*", "https://google.com/*"]
            },
        ];

        expect(sortResources(mergeWebAccessibleResources(input)))
            .toEqual(sortResources([
                {
                    "resources": ["a.js"],
                    "matches": ["<all_urls>"]
                },
                {
                    "resources": ["b.js"],
                    "matches": ["*://*/*"]
                },
                {
                    "resources": ["c.js"],
                    "matches": ["https://google.com/*"]
                },
            ]));
    });

    test("remove resources from other elements if they exist in elements with some common protocol pattern", () => {
        const input = [
            {
                "resources": ["a.js"],
                "matches": ["https://*/*", "http://*/*"]
            },
            {
                "resources": ["a.js", "b.js"],
                "matches": ["https://example.com/*"]
            },
            {
                "resources": ["a.js", "b.js"],
                "matches": ["http://google.com/*"]
            },
        ];

        expect(sortResources(mergeWebAccessibleResources(input)))
            .toEqual(sortResources([
                {
                    "resources": ["a.js"],
                    "matches": ["https://*/*", "http://*/*"]
                },
                {
                    "resources": ["b.js"],
                    "matches": ["https://example.com/*", "http://google.com/*"]
                },
            ]));
    });

    test("сomplete example", () => {
        const input = [
            // Case 1: Elements with the same matches - should be merged
            {
                "resources": ["common.js", "shared.css"],
                "matches": ["https://example.com/*"]
            },
            {
                "resources": ["shared.css", "extra.js"],
                "matches": ["https://example.com/*"]
            },

            // Case 2: Element with <all_urls> - should clean its matches and remove duplicate resources from other elements
            {
                "resources": ["global.js"],
                "matches": ["<all_urls>", "https://redundant.com/*", "*://*/*"]
            },

            // Case 3: Element with *://*/* - should clean matches and remove duplicate resources
            {
                "resources": ["universal.js"],
                "matches": ["*://*/*", "https://also-redundant.com/*"]
            },

            // Case 4: Elements with protocol-specific wildcards
            {
                "resources": ["https-only.js"],
                "matches": ["https://*/*"]
            },
            {
                "resources": ["http-only.js"],
                "matches": ["http://*/*"]
            },

            // Case 5: Elements that will be cleaned of resources due to <all_urls> and *://*/*
            {
                "resources": ["global.js", "local1.js"],
                "matches": ["https://site1.com/*"]
            },
            {
                "resources": ["universal.js", "local2.js"],
                "matches": ["http://site2.com/*"]
            },

            // Case 6: Elements that will be partially cleaned due to protocol-specific wildcards
            {
                "resources": ["https-only.js", "specific1.js"],
                "matches": ["https://specific-site.com/*"]
            },
            {
                "resources": ["http-only.js", "specific2.js"],
                "matches": ["http://another-site.com/*"]
            },

            // Case 7: Elements with special schemes - should not be covered by wildcards
            {
                "resources": ["extension.js"],
                "matches": ["chrome-extension://*/*"]
            },
            {
                "resources": ["file-access.js"],
                "matches": ["file://*/*"]
            },

            // Case 8: Elements that remain unchanged
            {
                "resources": ["unique.js"],
                "matches": ["ftp://special.com/*"]
            }
        ];

        expect(sortResources(mergeWebAccessibleResources(input)))
            .toEqual(sortResources([
                // Merged elements with the same matches
                {
                    "resources": ["common.js", "extra.js", "shared.css"],
                    "matches": ["https://example.com/*"]
                },

                // Element with <all_urls> (cleaned matches, unique resources)
                {
                    "resources": ["global.js"],
                    "matches": ["<all_urls>"]
                },

                // Element with *://*/* (cleaned matches)
                {
                    "resources": ["universal.js"],
                    "matches": ["*://*/*"]
                },

                // Protocol-specific wildcards
                {
                    "resources": ["https-only.js"],
                    "matches": ["https://*/*"]
                },
                {
                    "resources": ["http-only.js"],
                    "matches": ["http://*/*"]
                },

                // Elements with local resources (global.js removed due to <all_urls>)
                {
                    "resources": ["local1.js"],
                    "matches": ["https://site1.com/*"]
                },
                {
                    "resources": ["local2.js"],
                    "matches": ["http://site2.com/*"]
                },

                // Specific elements (partially cleaned due to protocol wildcards)
                {
                    "resources": ["specific1.js"],
                    "matches": ["https://specific-site.com/*"]
                },
                {
                    "resources": ["specific2.js"],
                    "matches": ["http://another-site.com/*"]
                },

                // Special schemes (unchanged)
                {
                    "resources": ["extension.js"],
                    "matches": ["chrome-extension://*/*"]
                },
                {
                    "resources": ["file-access.js"],
                    "matches": ["file://*/*"]
                },

                // Unique element
                {
                    "resources": ["unique.js"],
                    "matches": ["ftp://special.com/*"]
                }
            ]));
    });
});
