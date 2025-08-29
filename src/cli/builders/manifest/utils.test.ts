import {filterHostPatterns, mergeWebAccessibleResources} from "./utils";

import {ManifestAccessibleResource} from "@typing/manifest";

const toSet = (arr: string[]) => new Set(arr);
const setToArray = (set: Set<string>) => Array.from(set);
const sortResources = (resources: ManifestAccessibleResource[]): ManifestAccessibleResource[] => {
    return resources.map(({matches, resources}) => {
        const result = {};

        if (matches) result.matches = matches.sort();
        if (resources) result.resources = resources.sort();

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
                "matches": ["https://google.com/*"]
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
                    "matches": ["https://example.com/*"]
                },
                {
                    "resources": ["b.js"],
                    "matches": ["http://google.com/*"]
                },
            ]));
    });

    test("сomplete example", () => {
        const input = [
            // Випадок 1: Елементи з однаковими matches - повинні об'єднатися
            {
                "resources": ["common.js", "shared.css"],
                "matches": ["https://example.com/*"]
            },
            {
                "resources": ["shared.css", "extra.js"],
                "matches": ["https://example.com/*"]
            },

            // Випадок 2: Елемент з <all_urls> - повинен очистити свої matches та видалити дублікати ресурсів з інших елементів
            {
                "resources": ["global.js"],
                "matches": ["<all_urls>", "https://redundant.com/*", "*://*/*"]
            },

            // Випадок 3: Елемент з *://*/* - повинен очистити matches та видалити дублікати ресурсів
            {
                "resources": ["universal.js"],
                "matches": ["*://*/*", "https://also-redundant.com/*"]
            },

            // Випадок 4: Елементи з протокол-специфічними wildcards
            {
                "resources": ["https-only.js"],
                "matches": ["https://*/*"]
            },
            {
                "resources": ["http-only.js"],
                "matches": ["http://*/*"]
            },

            // Випадок 5: Елементи, які будуть очищені від ресурсів через <all_urls> і *://*/*
            {
                "resources": ["global.js", "local1.js"],
                "matches": ["https://site1.com/*"]
            },
            {
                "resources": ["universal.js", "local2.js"],
                "matches": ["http://site2.com/*"]
            },

            // Випадок 6: Елементи, які будуть частково очищені через протокол-специфічні wildcards
            {
                "resources": ["https-only.js", "specific1.js"],
                "matches": ["https://specific-site.com/*"]
            },
            {
                "resources": ["http-only.js", "specific2.js"],
                "matches": ["http://another-site.com/*"]
            },

            // Випадок 7: Елементи зі спеціальними схемами - не повинні бути покриті wildcards
            {
                "resources": ["extension.js"],
                "matches": ["chrome-extension://*/*"]
            },
            {
                "resources": ["file-access.js"],
                "matches": ["file://*/*"]
            },

            // Випадок 8: Елементи, які залишаються незмінними
            {
                "resources": ["unique.js"],
                "matches": ["ftp://special.com/*"]
            }
        ];

        expect(sortResources(mergeWebAccessibleResources(input)))
            .toEqual(sortResources([
                // Об'єднані елементи з однаковими matches
                {
                    "resources": ["common.js", "extra.js", "shared.css"],
                    "matches": ["https://example.com/*"]
                },

                // Елемент з <all_urls> (очищені matches, унікальні ресурси)
                {
                    "resources": ["global.js"],
                    "matches": ["<all_urls>"]
                },

                // Елемент з *://*/* (очищені matches)
                {
                    "resources": ["universal.js"],
                    "matches": ["*://*/*"]
                },

                // Протокол-специфічні wildcards
                {
                    "resources": ["https-only.js"],
                    "matches": ["https://*/*"]
                },
                {
                    "resources": ["http-only.js"],
                    "matches": ["http://*/*"]
                },

                // Елементи з локальними ресурсами (global.js видалений через <all_urls>)
                {
                    "resources": ["local1.js"],
                    "matches": ["https://site1.com/*"]
                },
                {
                    "resources": ["local2.js"],
                    "matches": ["http://site2.com/*"]
                },

                // Специфічні елементи (частково очищені через протокол wildcards)
                {
                    "resources": ["specific1.js"],
                    "matches": ["https://specific-site.com/*"]
                },
                {
                    "resources": ["specific2.js"],
                    "matches": ["http://another-site.com/*"]
                },

                // Спеціальні схеми (незмінені)
                {
                    "resources": ["extension.js"],
                    "matches": ["chrome-extension://*/*"]
                },
                {
                    "resources": ["file-access.js"],
                    "matches": ["file://*/*"]
                },

                // Унікальний елемент
                {
                    "resources": ["unique.js"],
                    "matches": ["ftp://special.com/*"]
                }
            ]));
    });
});
