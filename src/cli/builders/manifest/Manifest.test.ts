import ManifestV3 from "./ManifestV3";
import {Browser, DataCollectionPermission} from "@typing/browser";
import {Language} from "@typing/locale";
import {ManifestIncognito} from "@typing/manifest";

describe("Manifest primitive properties", () => {
    it("name", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setName("InternalName");
        builder1.raw({name: "OptionalName"});
        expect((builder1.build() as any).name).toBe("InternalName");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({name: "OptionalName"});
        expect((builder2.build() as any).name).toBe("OptionalName");

        const builder3 = new ManifestV3(Browser.Chrome);
        expect((builder3.build() as any).name).toBe("__MSG_app_name__");
    });

    it("short_name", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setShortName("Short");
        builder1.raw({short_name: "OptShort"});
        expect((builder1.build() as any).short_name).toBe("Short");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({short_name: "OptShort"});
        expect((builder2.build() as any).short_name).toBe("OptShort");

        const builder3 = new ManifestV3(Browser.Chrome);
        expect((builder3.build() as any).short_name).toBeUndefined();
    });

    it("description", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setDescription("Desc");
        builder1.raw({description: "OptDesc"});
        expect((builder1.build() as any).description).toBe("Desc");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({description: "OptDesc"});
        expect((builder2.build() as any).description).toBe("OptDesc");

        const builder3 = new ManifestV3(Browser.Chrome);
        expect((builder3.build() as any).description).toBeUndefined();
    });

    it("version", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setVersion("1.2.3");
        builder1.raw({version: "9.9.9"});
        expect((builder1.build() as any).version).toBe("1.2.3");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({version: "9.9.9"});
        expect((builder2.build() as any).version).toBe("9.9.9");

        const builder3 = new ManifestV3(Browser.Chrome);
        expect((builder3.build() as any).version).toBe("0.0.0");
    });

    it("minimum_chrome_version", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setMinimumVersion("120.0.0");
        builder1.raw({minimum_chrome_version: "100.0.0"});
        expect((builder1.build() as any).minimum_chrome_version).toBe("120.0.0");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({minimum_chrome_version: "100.0.0"});
        expect((builder2.build() as any).minimum_chrome_version).toBe("100.0.0");

        const builder3 = new ManifestV3(Browser.Chrome);
        expect((builder3.build() as any).minimum_chrome_version).toBeUndefined();
    });

    it("author", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setAuthor("Internal Author");
        builder1.raw({author: "Optional Author"});
        expect((builder1.build() as any).author).toBe("Internal Author");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({author: "Optional Author"});
        expect((builder2.build() as any).author).toBe("Optional Author");

        const builder3 = new ManifestV3(Browser.Chrome);
        expect((builder3.build() as any).author).toBeUndefined();
    });

    it("homepage_url", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setHomepage("https://internal.example.com");
        builder1.raw({homepage_url: "https://raw.example.com"});
        expect((builder1.build() as any).homepage_url).toBe("https://internal.example.com");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({homepage_url: "https://raw.example.com"});
        expect((builder2.build() as any).homepage_url).toBe("https://raw.example.com");

        const builder3 = new ManifestV3(Browser.Chrome);
        expect((builder3.build() as any).homepage_url).toBeUndefined();
    });

    it("incognito", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setIncognito(ManifestIncognito.Split);
        builder1.raw({incognito: ManifestIncognito.Spanning});
        expect((builder1.build() as any).incognito).toBe(ManifestIncognito.Split);

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({incognito: ManifestIncognito.Spanning});
        expect((builder2.build() as any).incognito).toBe(ManifestIncognito.Spanning);

        const builder3 = new ManifestV3(Browser.Chrome);
        expect((builder3.build() as any).incognito).toBeUndefined();
    });

    it("default_locale", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setLocale(Language.Ukrainian);
        builder1.raw({default_locale: Language.English});
        expect((builder1.build() as any).default_locale).toBe(Language.Ukrainian);

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({default_locale: Language.English});
        expect((builder2.build() as any).default_locale).toBe(Language.English);

        const builder3 = new ManifestV3(Browser.Chrome);
        expect((builder3.build() as any).default_locale).toBeUndefined();
    });
});

describe("Manifest common builder methods", () => {
    it("get returns the built manifest", () => {
        const builder = new ManifestV3(Browser.Chrome).setName("My Addon").setVersion("1.0.0");

        expect(builder.get()).toEqual(builder.build());
    });

    it("merges raw objects and arrays and keeps unknown raw fields", () => {
        const builder = new ManifestV3(Browser.Chrome);

        builder
            .raw({permissions: ["tabs"], chrome_url_overrides: {newtab: "first.html"}} as any)
            .raw({permissions: ["storage"], commands: {cmd1: {description: "First"}}})
            .raw({commands: {cmd2: {description: "Second"}}});

        const manifest: any = builder.build();

        expect(manifest.permissions).toEqual(expect.arrayContaining(["tabs", "storage"]));
        expect(manifest.commands).toEqual(
            expect.objectContaining({
                cmd1: {description: "First"},
                cmd2: {description: "Second"},
            })
        );
        expect(manifest.chrome_url_overrides).toEqual({newtab: "first.html"});
    });

    it("builds commands from setCommands and raw commands", () => {
        const builder = new ManifestV3(Browser.Chrome);

        builder.setCommands(
            new Set([
                {name: "internal_command"},
                {
                    name: "common",
                    description: "Internal description",
                    chromeosKey: "Internal chromeosKey",
                },
            ])
        );

        builder.raw({
            commands: {
                raw_command: {},
                common: {
                    description: "Raw description",
                    suggested_key: {
                        mac: "Raw macKey",
                    },
                },
            },
        });

        const commands: any = builder.build().commands;

        expect(commands.raw_command).toBeDefined();
        expect(commands.internal_command).toBeDefined();
        expect(commands.common.description).toBe("Internal description");
        expect(commands.common.suggested_key.chromeos).toBe("Internal chromeosKey");
        expect(commands.common.suggested_key.mac).toBe("Raw macKey");
    });

    it("resets commands when setCommands is called without a set", () => {
        const builder = new ManifestV3(Browser.Chrome);

        const manifest: any = builder
            .setCommands(new Set([{name: "internal_command"}]))
            .setCommands()
            .build();

        expect(manifest.commands).toBeUndefined();
    });

    it("selects icon groups and falls back to the default group", () => {
        const builder = new ManifestV3(Browser.Chrome);

        builder
            .setIcons(
                new Map([
                    ["default", new Map([[16, "default16.png"]])],
                    ["popup", new Map([[32, "popup32.png"]])],
                ])
            )
            .setIcon("popup")
            .raw({icons: {48: "raw48.png"}});

        expect((builder.build() as any).icons).toEqual({
            32: "popup32.png",
            48: "raw48.png",
        });

        const fallback = new ManifestV3(Browser.Chrome)
            .setIcons(new Map([["default", new Map([[16, "default16.png"]])]]))
            .setIcon("missing")
            .build() as any;

        expect(fallback.icons).toEqual({16: "default16.png"});
    });

    it("resets icons when setIcons is called without a map", () => {
        const manifest: any = new ManifestV3(Browser.Chrome)
            .setIcons(new Map([["default", new Map([[16, "default16.png"]])]]))
            .setIcons()
            .build();

        expect(manifest.icons).toBeUndefined();
    });

    it("collects accessible resources through add, append, set, and raw inputs", () => {
        const builder = new ManifestV3(Browser.Chrome);

        builder
            .addAccessibleResource({resources: ["img/add.png"], matches: ["https://add.example.com/*"]})
            .appendAccessibleResources(
                new Set([{resources: ["img/append.png"], matches: ["https://append.example.com/*"]}])
            )
            .setAccessibleResource(new Set([{resources: ["img/set.png"], matches: ["https://set.example.com/*"]}]))
            .raw({
                web_accessible_resources: [{resources: ["img/raw.png"], matches: ["https://raw.example.com/*"]}],
            });

        expect(builder.getWebAccessibleResources()).toEqual(
            expect.arrayContaining([
                {resources: ["img/set.png"], matches: ["https://set.example.com/*"]},
                {resources: ["img/raw.png"], matches: ["https://raw.example.com/*"]},
            ])
        );
        expect(builder.getWebAccessibleResources()).not.toEqual(
            expect.arrayContaining([{resources: ["img/add.png"], matches: ["https://add.example.com/*"]}])
        );
    });
});

describe("Manifest browser specific settings", () => {
    it("sets and merges Firefox browser specific settings", () => {
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

        const settings: any = builder.build().browser_specific_settings;

        expect(settings.gecko.id).toBe("initial@id");
        expect(settings.gecko.strict_min_version).toBe("100.0");
        expect(settings.gecko.strict_max_version).toBe("120.0");
        expect(settings.gecko.data_collection_permissions.required).toEqual(
            expect.arrayContaining([DataCollectionPermission.WebsiteActivity, DataCollectionPermission.SearchTerms])
        );
        expect(settings.gecko.data_collection_permissions.optional).toEqual(
            expect.arrayContaining([
                DataCollectionPermission.AuthenticationInfo,
                DataCollectionPermission.BrowsingActivity,
            ])
        );
        expect(settings.gecko.data_collection_permissions.optional.length).toBe(2);
        expect(settings.safari).toBeUndefined();
    });

    it("includes Safari browser specific settings for Safari builds", () => {
        const builder = new ManifestV3(Browser.Safari);

        builder
            .mergeSpecific({
                safari: {
                    strictMinVersion: "15",
                },
            })
            .raw({
                browser_specific_settings: {
                    safari: {
                        strict_max_version: "20",
                    },
                },
            });

        const manifest: any = builder.build();

        expect(manifest.browser_specific_settings.safari.strict_min_version).toBe("15");
        expect(manifest.browser_specific_settings.safari.strict_max_version).toBe("20");
    });

    it("merges raw Firefox settings with typed Firefox settings", () => {
        const builder = new ManifestV3(Browser.Firefox);

        builder
            .setSpecific({
                gecko: {
                    dataCollectionPermissions: {
                        required: [DataCollectionPermission.BrowsingActivity],
                    },
                },
            })
            .raw({
                browser_specific_settings: {
                    gecko: {
                        id: "from@optional",
                        update_url: "https://example.com/update.json",
                        strict_min_version: "110.0",
                        strict_max_version: "119.0",
                        data_collection_permissions: {
                            required: [DataCollectionPermission.WebsiteActivity],
                            optional: [DataCollectionPermission.AuthenticationInfo],
                        },
                    },
                    gecko_android: {
                        strict_min_version: "110.0",
                        strict_max_version: "119.0",
                    },
                },
            });

        const settings: any = builder.build().browser_specific_settings;

        expect(settings.gecko.id).toBe("from@optional");
        expect(settings.gecko.update_url).toBe("https://example.com/update.json");
        expect(settings.gecko.strict_min_version).toBe("110.0");
        expect(settings.gecko.strict_max_version).toBe("119.0");
        expect(settings.gecko.data_collection_permissions.required).toEqual(
            expect.arrayContaining([
                DataCollectionPermission.WebsiteActivity,
                DataCollectionPermission.BrowsingActivity,
            ])
        );
        expect(settings.gecko_android.strict_min_version).toBe("110.0");
        expect(settings.gecko_android.strict_max_version).toBe("119.0");
    });

    it("uses raw browser specific settings when setSpecific clears typed settings", () => {
        const manifest: any = new ManifestV3(Browser.Safari)
            .mergeSpecific({safari: {strictMinVersion: "15"}})
            .setSpecific()
            .raw({
                browser_specific_settings: {
                    safari: {
                        strict_min_version: "16",
                    },
                },
            })
            .build();

        expect(manifest.browser_specific_settings.safari.strict_min_version).toBe("16");
    });
});
