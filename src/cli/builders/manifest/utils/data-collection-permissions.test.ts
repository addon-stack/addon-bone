import {normalizeDataCollectionPermissions} from "./data-collection-permissions";
import {DataCollectionPermission} from "@typing/browser";

describe("normalizeDataCollectionPermissions", () => {
    it("should return default required 'none' if input is empty", () => {
        const result = normalizeDataCollectionPermissions();

        expect(result).toEqual({
            required: ["none"],
            optional: undefined,
        });
    });

    it("should remove 'none' if real permissions are provided in required", () => {
        const input = {
            required: ["none" as any, DataCollectionPermission.WebsiteActivity],
        };

        const result = normalizeDataCollectionPermissions(input);

        expect(result.required).toEqual([DataCollectionPermission.WebsiteActivity]);
        expect(result.required).not.toContain("none");
    });

    it("should keep 'none' if it is the only permission in required", () => {
        const input = {
            required: ["none" as any],
        };

        const result = normalizeDataCollectionPermissions(input);

        expect(result.required).toEqual(["none"]);
        expect(result.optional).toBeUndefined();
    });

    it("should deduplicate permissions in required and optional", () => {
        const input = {
            required: [DataCollectionPermission.WebsiteActivity, DataCollectionPermission.WebsiteActivity],
            optional: [DataCollectionPermission.SearchTerms, DataCollectionPermission.SearchTerms],
        };

        const result = normalizeDataCollectionPermissions(input);

        expect(result.required).toEqual([DataCollectionPermission.WebsiteActivity]);
        expect(result.optional).toEqual([DataCollectionPermission.SearchTerms]);
    });

    it("should remove permissions from optional if they are in required", () => {
        const input = {
            required: [DataCollectionPermission.WebsiteActivity],
            optional: [DataCollectionPermission.WebsiteActivity, DataCollectionPermission.SearchTerms],
        };

        const result = normalizeDataCollectionPermissions(input);

        expect(result.required).toEqual([DataCollectionPermission.WebsiteActivity]);
        expect(result.optional).toEqual([DataCollectionPermission.SearchTerms]);
    });

    it("should handle mixed string and enum permissions including new BookmarksInfo", () => {
        const input = {
            required: ["websiteActivity" as any, DataCollectionPermission.SearchTerms],
            optional: ["searchTerms" as any, DataCollectionPermission.BookmarksInfo],
        };

        // "searchTerms" is in both, so it should be removed from optional
        const result = normalizeDataCollectionPermissions(input);

        expect(result.required).toContain("websiteActivity");
        expect(result.required).toContain(DataCollectionPermission.SearchTerms);
        expect(result.optional).toEqual([DataCollectionPermission.BookmarksInfo]);
    });

    it("should filter out invalid permissions not present in the enum", () => {
        const input = {
            required: ["invalid-permission" as any, DataCollectionPermission.WebsiteActivity],
            optional: [DataCollectionPermission.SearchTerms, "another-garbage" as any],
        };

        const result = normalizeDataCollectionPermissions(input);

        expect(result.required).toEqual([DataCollectionPermission.WebsiteActivity]);
        expect(result.optional).toEqual([DataCollectionPermission.SearchTerms]);
    });

    it("should remove 'none' from optional permissions", () => {
        const input = {
            required: [DataCollectionPermission.WebsiteActivity],
            optional: ["none" as any, DataCollectionPermission.SearchTerms],
        };

        const result = normalizeDataCollectionPermissions(input);

        expect(result.optional).toEqual([DataCollectionPermission.SearchTerms]);
        expect(result.optional).not.toContain("none");
    });

    it("should sort permissions alphabetically in both arrays", () => {
        const input = {
            required: [DataCollectionPermission.WebsiteActivity, DataCollectionPermission.SearchTerms],
            optional: [DataCollectionPermission.LocationInfo, DataCollectionPermission.AuthenticationInfo],
        };

        const result = normalizeDataCollectionPermissions(input);

        // Sorting check: searchTerms < websiteActivity
        expect(result.required).toEqual([
            DataCollectionPermission.SearchTerms,
            DataCollectionPermission.WebsiteActivity,
        ]);

        // Sorting check: authenticationInfo < locationInfo
        expect(result.optional).toEqual([
            DataCollectionPermission.AuthenticationInfo,
            DataCollectionPermission.LocationInfo,
        ]);
    });
});
