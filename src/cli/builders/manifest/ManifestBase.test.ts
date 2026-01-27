import ManifestV3 from "./ManifestV3";
import {Browser, DataCollectionPermission} from "@typing/browser";

describe("ManifestBase mergeSpecific", () => {
    it("should perform a deep merge of browser specific settings", () => {
        const builder = new ManifestV3(Browser.Firefox);

        builder.setSpecific({
            gecko: {
                id: "initial@id",
                strictMinVersion: "100.0",
                dataCollectionPermissions: {
                    required: [DataCollectionPermission.WebsiteActivity],
                    optional: [DataCollectionPermission.AuthenticationInfo],
                },
            },
        });

        builder.mergeSpecific({
            gecko: {
                strictMaxVersion: "120.0",
                dataCollectionPermissions: {
                    required: [DataCollectionPermission.SearchTerms],
                    optional: [DataCollectionPermission.AuthenticationInfo, DataCollectionPermission.BrowsingActivity],
                },
            },
            safari: {
                strictMinVersion: "15",
            },
        });

        const manifest: any = builder.build();
        const settings = manifest.browser_specific_settings;

        expect(settings.gecko.id).toBe("initial@id");
        expect(settings.gecko.strict_min_version).toBe("100.0");
        expect(settings.gecko.strict_max_version).toBe("120.0");

        // Check union of arrays
        expect(settings.gecko.data_collection_permissions.required).toContain(DataCollectionPermission.WebsiteActivity);
        expect(settings.gecko.data_collection_permissions.required).toContain(DataCollectionPermission.SearchTerms);
        expect(settings.gecko.data_collection_permissions.required.length).toBe(2);

        expect(settings.gecko.data_collection_permissions.optional).toContain(
            DataCollectionPermission.AuthenticationInfo
        );
        expect(settings.gecko.data_collection_permissions.optional).toContain(
            DataCollectionPermission.BrowsingActivity
        );
        expect(settings.gecko.data_collection_permissions.optional.length).toBe(2); // AuthenticationInfo should not be duplicated

        expect(settings.safari).toBeUndefined(); // buildBrowserSpecificSettings for Firefox doesn't include safari
    });

    it("should include safari settings when browser is Safari", () => {
        const builder = new ManifestV3(Browser.Safari);
        builder.mergeSpecific({
            safari: {
                strictMinVersion: "15",
            },
        });

        const manifest: any = builder.build();
        expect(manifest.browser_specific_settings.safari.strict_min_version).toBe("15");
    });
});
