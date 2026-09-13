import {filterOptionalPermissions} from "./permissions";

type ManifestPermission = chrome.runtime.ManifestPermission;
type ManifestOptionalPermission = chrome.runtime.ManifestOptionalPermission;

describe("filterOptionalPermissions", () => {
    test("removes permissions that are already required", () => {
        const required = new Set<ManifestPermission>(["storage"]);
        const optional = new Set<ManifestOptionalPermission>(["storage", "tabs"]);

        const result = filterOptionalPermissions(optional, required);

        expect(result).toEqual(expect.arrayContaining(["tabs"]));
        expect(result).not.toEqual(expect.arrayContaining(["storage"]));
        expect(result.length).toBe(1);
    });

    test("drops activeTab from optional when tabs is present in optional", () => {
        const optional = new Set<ManifestOptionalPermission>(["activeTab", "tabs"]);
        const required = new Set<ManifestPermission>();

        const result = filterOptionalPermissions(optional, required);

        // filterPermissions removes activeTab when tabs is present in the union
        expect(result).toEqual(["tabs"]);
    });

    test("drops activeTab from optional when tabs is present in required", () => {
        const optional = new Set<ManifestOptionalPermission>(["activeTab"]);
        const required = new Set<ManifestPermission>(["tabs"]);

        const result = filterOptionalPermissions(optional, required);

        // Union contains tabs and activeTab; filterPermissions removes activeTab, then diff removes tabs as required -> empty
        expect(result).toEqual([]);
    });

    test("keeps activeTab when tabs is absent from both optional and required", () => {
        const optional = new Set<ManifestOptionalPermission>(["activeTab"]);
        const required = new Set<ManifestPermission>();

        const result = filterOptionalPermissions(optional, required);

        expect(result).toEqual(["activeTab"]);
    });

    test("deduplicates and filters correctly when mixing optional and required", () => {
        const optional = new Set<ManifestOptionalPermission>(["tabs", "storage", "activeTab"]);
        const required = new Set<ManifestPermission>(["storage"]);

        const result = filterOptionalPermissions(optional, required);

        // activeTab should be removed because tabs is present; storage removed because it's required
        expect(result).toEqual(["tabs"]);
    });
});
