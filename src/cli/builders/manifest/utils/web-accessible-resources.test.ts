import {mergeWebAccessibleResources} from "./web-accessible-resources";
import {ManifestAccessibleResource} from "@typing/manifest";

const sortResources = (resources: ManifestAccessibleResource[]): ManifestAccessibleResource[] => {
    return resources.map(r => {
        const result: ManifestAccessibleResource = {resources: r.resources};

        if (r.matches) result.matches = r.matches.sort();
        if (r.extensionIds) result.extensionIds = r.extensionIds.sort();
        if (r.useDynamicUrl !== undefined) result.useDynamicUrl = r.useDynamicUrl;

        return result;
    });
};

describe("mergeWebAccessibleResources", () => {
    test("normalizes matches to origins before simplifying domain wildcards", () => {
        const result = mergeWebAccessibleResources([
            {
                resources: ["resource.js"],
                matches: [
                    "https://example.com/path/file.json?key=value",
                    "https://*.example.com/path/*",
                    "https://sub.example.com/other/*",
                ],
            },
        ]);

        expect(result).toEqual([
            {
                resources: ["resource.js"],
                matches: ["https://*.example.com/*"],
            },
        ]);
    });

    test("simplifies matches after merging separate rules", () => {
        expect(
            mergeWebAccessibleResources([
                {resources: ["a.js"], matches: ["https://example.com/path/*"]},
                {resources: ["a.js"], matches: ["https://sub.example.com/nested/*"]},
                {resources: ["a.js"], matches: ["https://*.example.com/*"]},
            ])
        ).toEqual([{resources: ["a.js"], matches: ["https://*.example.com/*"]}]);
    });

    test("keeps both the root domain and a subdomain when neither has a host wildcard", () => {
        expect(
            mergeWebAccessibleResources([
                {resources: ["a.js"], matches: ["https://example.com/path/*"]},
                {resources: ["a.js"], matches: ["https://sub.example.com/nested/*"]},
            ])
        ).toEqual([{resources: ["a.js"], matches: ["https://example.com/*", "https://sub.example.com/*"]}]);
    });

    test.each([
        ["https://*/*", "http://example.org/*"],
        ["*://*/*", "file:///*"],
        ["*://*/*", "ftp://example.org/*"],
        ["*://*/*", "ws://example.org/*"],
        ["*://*/*", "wss://example.org/*"],
        ["https://*.example.com/*", "https://example.org/*"],
        ["https://*.example.com/*", "https://otherexample.com/*"],
    ])("keeps resources when %s does not cover every match, including %s", (covering, uncovered) => {
        const input = [
            {resources: ["a.js"], matches: [covering]},
            {resources: ["a.js", "b.js"], matches: ["https://sub.example.com/*", uncovered]},
        ];

        expect(sortResources(mergeWebAccessibleResources(input))).toEqual(sortResources(input));
    });

    test("removes a duplicate covered by a domain wildcard and merges again after cleanup", () => {
        expect(
            mergeWebAccessibleResources([
                {resources: ["a.js"], matches: ["https://*.example.com/*"]},
                {resources: ["a.js", "b.js"], matches: ["https://example.com/*", "https://sub.example.com/*"]},
                {resources: ["b.js"], matches: ["https://example.org/*"]},
            ])
        ).toEqual([
            {resources: ["a.js"], matches: ["https://*.example.com/*"]},
            {
                resources: ["b.js"],
                matches: ["https://example.com/*", "https://example.org/*", "https://sub.example.com/*"],
            },
        ]);
    });

    test("does not create access for a different resource and origin pair", () => {
        const input = [
            {resources: ["a.js"], matches: ["https://example.com/*"]},
            {resources: ["b.js"], matches: ["https://example.org/*"]},
        ];

        expect(mergeWebAccessibleResources(input)).toEqual(input);
    });

    test("keeps resource wildcards and paths independent from origin normalization", () => {
        expect(
            mergeWebAccessibleResources([
                {resources: ["/nested/*", "*.json"], matches: ["https://example.com/path/file.json?key=value"]},
                {resources: ["*.json"], matches: ["https://example.com/nested/*"]},
            ])
        ).toEqual([{resources: ["*.json", "/nested/*"], matches: ["https://example.com/*"]}]);
    });

    test("normalizes the all-extensions wildcard before and after merging", () => {
        expect(
            mergeWebAccessibleResources([
                {resources: ["a.js"], extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]},
                {resources: ["a.js"], extensionIds: ["*", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]},
            ])
        ).toEqual([{resources: ["a.js"], extensionIds: ["*"]}]);
    });

    test("requires coverage of both web origins and extension IDs before removing resources", () => {
        const input = [
            {resources: ["a.js"], matches: ["<all_urls>"]},
            {resources: ["b.js"], extensionIds: ["*"]},
            {
                resources: ["a.js", "b.js", "c.js"],
                matches: ["https://example.com/*"],
                extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
            },
        ];

        expect(mergeWebAccessibleResources(input)).toEqual(input);
    });

    test("removes duplicates when every extension ID is covered", () => {
        expect(
            mergeWebAccessibleResources([
                {resources: ["a.js"], extensionIds: ["*"]},
                {resources: ["a.js", "b.js"], extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]},
            ])
        ).toEqual([
            {resources: ["a.js"], extensionIds: ["*"]},
            {resources: ["b.js"], extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]},
        ]);
    });

    test("merges explicit and default static URLs while keeping dynamic rules separate", () => {
        expect(
            mergeWebAccessibleResources([
                {resources: ["a.js"], matches: ["https://example.com/*"]},
                {resources: ["b.js"], matches: ["https://example.com/*"], useDynamicUrl: false},
                {resources: ["a.js"], matches: ["https://example.com/*"], useDynamicUrl: true},
            ])
        ).toEqual([
            {resources: ["a.js", "b.js"], matches: ["https://example.com/*"], useDynamicUrl: false},
            {resources: ["a.js"], matches: ["https://example.com/*"], useDynamicUrl: true},
        ]);
    });

    test("is idempotent and does not mutate input rules", () => {
        const input = [
            {resources: ["a.js"], matches: ["https://*.example.com/path/*"]},
            {resources: ["b.js", "a.js", "b.js"], matches: ["https://sub.example.com/nested/*"]},
            {resources: ["b.js"], matches: ["https://example.org/*"]},
        ];
        const original = JSON.parse(JSON.stringify(input));
        const output = mergeWebAccessibleResources(input);

        expect(input).toEqual(original);
        expect(mergeWebAccessibleResources(output)).toEqual(output);
        expect(mergeWebAccessibleResources([])).toEqual([]);
    });

    test("merge resources with same matches without duplicates", () => {
        const input = [
            {
                resources: ["a.js", "b.js"],
                matches: ["https://example.com/*"],
            },
            {
                resources: ["b.js", "c.js"],
                matches: ["https://example.com/*"],
            },
            {
                resources: ["c.js", "d.js"],
                matches: ["https://example.com/*"],
            },
        ];

        expect(sortResources(mergeWebAccessibleResources(input))).toEqual(
            sortResources([
                {
                    resources: ["a.js", "b.js", "c.js", "d.js"],
                    matches: ["https://example.com/*"],
                },
            ])
        );
    });

    test("remove unnecessary matches in one element", () => {
        const input_1 = [
            {
                resources: ["a.js"],
                matches: ["<all_urls>", "https://example.com/*"],
            },
        ];

        const input_2 = [
            {
                resources: ["a.js"],
                matches: ["*://*/*", "https://example.com/*"],
            },
        ];

        expect(sortResources(mergeWebAccessibleResources(input_1))).toEqual(
            sortResources([
                {
                    resources: ["a.js"],
                    matches: ["<all_urls>"],
                },
            ])
        );

        expect(sortResources(mergeWebAccessibleResources(input_2))).toEqual(
            sortResources([
                {
                    resources: ["a.js"],
                    matches: ["*://*/*"],
                },
            ])
        );
    });

    test("remove resources from other elements if they exist in the element with <all_urls> or *://*/* pattern", () => {
        const input = [
            {
                resources: ["a.js"],
                matches: ["<all_urls>"],
            },
            {
                resources: ["b.js"],
                matches: ["*://*/*"],
            },
            {
                resources: ["a.js", "b.js"],
                matches: ["https://example.com/*"],
            },
            {
                resources: ["a.js", "b.js", "c.js"],
                matches: ["https://example.org/*", "https://example.org/*"],
            },
        ];

        expect(sortResources(mergeWebAccessibleResources(input))).toEqual(
            sortResources([
                {
                    resources: ["a.js"],
                    matches: ["<all_urls>"],
                },
                {
                    resources: ["b.js"],
                    matches: ["*://*/*"],
                },
                {
                    resources: ["c.js"],
                    matches: ["https://example.org/*"],
                },
            ])
        );
    });

    test("remove resources from other elements if they exist in elements with some common protocol pattern", () => {
        const input = [
            {
                resources: ["a.js"],
                matches: ["https://*/*", "http://*/*"],
            },
            {
                resources: ["a.js", "b.js"],
                matches: ["https://example.com/*"],
            },
            {
                resources: ["a.js", "b.js"],
                matches: ["http://example.org/*"],
            },
        ];

        expect(sortResources(mergeWebAccessibleResources(input))).toEqual(
            sortResources([
                {
                    resources: ["a.js"],
                    matches: ["https://*/*", "http://*/*"],
                },
                {
                    resources: ["b.js"],
                    matches: ["https://example.com/*", "http://example.org/*"],
                },
            ])
        );
    });

    test("сomplete example", () => {
        const input = [
            // Case 1: Elements with the same matches - should be merged
            {
                resources: ["common.js", "shared.css"],
                matches: ["https://example.com/*"],
            },
            {
                resources: ["shared.css", "extra.js"],
                matches: ["https://example.com/*"],
            },

            // Case 2: Element with <all_urls> - should clean its matches and remove duplicate resources from other elements
            {
                resources: ["global.js"],
                matches: ["<all_urls>", "https://redundant.example.com/*", "*://*/*"],
            },

            // Case 3: Element with *://*/* - should clean matches and remove duplicate resources
            {
                resources: ["universal.js"],
                matches: ["*://*/*", "https://also-redundant.example.com/*"],
            },

            // Case 4: Elements with protocol-specific wildcards
            {
                resources: ["https-only.js"],
                matches: ["https://*/*"],
            },
            {
                resources: ["http-only.js"],
                matches: ["http://*/*"],
            },

            // Case 5: Elements that will be cleaned of resources due to <all_urls> and *://*/*
            {
                resources: ["global.js", "local1.js"],
                matches: ["https://site1.example.com/*"],
            },
            {
                resources: ["universal.js", "local2.js"],
                matches: ["http://site2.example.com/*"],
            },

            // Case 6: Elements that will be partially cleaned due to protocol-specific wildcards
            {
                resources: ["https-only.js", "specific1.js"],
                matches: ["https://specific.example.com/*"],
            },
            {
                resources: ["http-only.js", "specific2.js"],
                matches: ["http://another.example.com/*"],
            },

            // Case 7: Extension-only and file access
            {
                resources: ["extension.js"],
                extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
            },
            {
                resources: ["file-access.js"],
                matches: ["file:///*"],
            },

            // Case 8: Elements that remain unchanged
            {
                resources: ["unique.js"],
                matches: ["ftp://special.example.com/*"],
            },
        ];

        expect(sortResources(mergeWebAccessibleResources(input))).toEqual(
            sortResources([
                // Merged elements with the same matches
                {
                    resources: ["common.js", "extra.js", "shared.css"],
                    matches: ["https://example.com/*"],
                },

                // Element with <all_urls> (cleaned matches, unique resources)
                {
                    resources: ["global.js"],
                    matches: ["<all_urls>"],
                },

                // Element with *://*/* (cleaned matches)
                {
                    resources: ["universal.js"],
                    matches: ["*://*/*"],
                },

                // Protocol-specific wildcards
                {
                    resources: ["https-only.js"],
                    matches: ["https://*/*"],
                },
                {
                    resources: ["http-only.js"],
                    matches: ["http://*/*"],
                },

                // Elements with local resources (global.js removed due to <all_urls>)
                {
                    resources: ["local1.js"],
                    matches: ["https://site1.example.com/*"],
                },
                {
                    resources: ["local2.js"],
                    matches: ["http://site2.example.com/*"],
                },

                // Specific elements (partially cleaned due to protocol wildcards)
                {
                    resources: ["specific1.js"],
                    matches: ["https://specific.example.com/*"],
                },
                {
                    resources: ["specific2.js"],
                    matches: ["http://another.example.com/*"],
                },

                // Extension-only and file access (unchanged)
                {
                    resources: ["extension.js"],
                    extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
                },
                {
                    resources: ["file-access.js"],
                    matches: ["file:///*"],
                },

                // Unique element
                {
                    resources: ["unique.js"],
                    matches: ["ftp://special.example.com/*"],
                },
            ])
        );
    });

    test("performs multi-iteration merging across keys (regression for changed accumulation)", () => {
        const input: ManifestAccessibleResource[] = [
            {resources: ["a.js"], matches: ["https://m1.example.com/*"]},
            {resources: ["b.js"], matches: ["https://m1.example.com/*"]},
            {resources: ["a.js", "b.js"], matches: ["https://m2.example.com/*"]},
        ];

        const output = sortResources(mergeWebAccessibleResources(input));

        expect(output).toEqual(
            sortResources([
                {resources: ["a.js", "b.js"], matches: ["https://m1.example.com/*", "https://m2.example.com/*"]},
            ])
        );
    });

    test("merges by extensionIds when other fields are equal", () => {
        const input: ManifestAccessibleResource[] = [
            {
                resources: ["r.js"],
                matches: ["https://site.example.com/*"],
                extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
            },
            {
                resources: ["r.js"],
                matches: ["https://site.example.com/*"],
                extensionIds: ["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
            },
        ];

        const output = sortResources(mergeWebAccessibleResources(input));

        expect(output).toEqual(
            sortResources([
                {
                    resources: ["r.js"],
                    matches: ["https://site.example.com/*"],
                    extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
                },
            ])
        );
    });

    test("cleanup with <all_urls> respects extensionIds and useDynamicUrl", () => {
        const input: ManifestAccessibleResource[] = [
            // Global entry for id1, useDynamicUrl true
            {
                resources: ["g.js"],
                matches: ["<all_urls>"],
                extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
                useDynamicUrl: true,
            },
            // Same id and useDynamic -> removal should happen
            {
                resources: ["g.js", "keep1.js"],
                matches: ["https://site.example.com/*"],
                extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
                useDynamicUrl: true,
            },
            // Different extensionIds -> should NOT be removed
            {
                resources: ["g.js", "keep2.js"],
                matches: ["https://site.example.com/*"],
                extensionIds: ["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
                useDynamicUrl: true,
            },
            // Different useDynamicUrl -> should NOT be removed
            {
                resources: ["g.js", "keep3.js"],
                matches: ["https://site.example.com/*"],
                extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
                useDynamicUrl: false,
            },
        ];

        const output = sortResources(mergeWebAccessibleResources(input));

        expect(output).toEqual(
            sortResources([
                {
                    resources: ["g.js"],
                    matches: ["<all_urls>"],
                    extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
                    useDynamicUrl: true,
                },
                {
                    resources: ["keep1.js"],
                    matches: ["https://site.example.com/*"],
                    extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
                    useDynamicUrl: true,
                },
                {
                    resources: ["g.js", "keep2.js"],
                    matches: ["https://site.example.com/*"],
                    extensionIds: ["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
                    useDynamicUrl: true,
                },
                {
                    resources: ["g.js", "keep3.js"],
                    matches: ["https://site.example.com/*"],
                    extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
                    useDynamicUrl: false,
                },
            ])
        );
    });
});
