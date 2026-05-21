import ManifestV3 from "./ManifestV3";
import ManifestV2 from "./ManifestV2";
import {Browser, DataCollectionPermission} from "@typing/browser";

const unique = (arr: string[]) => Array.from(new Set(arr)).length === arr.length;

describe("ManifestBase primitive properties", () => {
    it("name", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setName("InternalName");
        builder1.raw({name: "OptionalName"});
        const manifest1: any = builder1.build();
        expect(manifest1.name).toBe("InternalName");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({name: "OptionalName"});
        const manifest2: any = builder2.build();
        expect(manifest2.name).toBe("OptionalName");

        const builder3 = new ManifestV3(Browser.Chrome);
        const manifest3: any = builder3.build();
        expect(manifest3.name).toBe("__MSG_app_name__");
    });

    it("short_name", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setShortName("Short");
        builder1.raw({short_name: "OptShort"});
        const manifest1: any = builder1.build();
        expect(manifest1.short_name).toBe("Short");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({short_name: "OptShort"});
        const manifest2: any = builder2.build();
        expect(manifest2.short_name).toBe("OptShort");

        const builder3 = new ManifestV3(Browser.Chrome);
        const manifest3: any = builder3.build();
        expect(manifest3.short_name).toBeUndefined();
    });

    it("description", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setDescription("Desc");
        builder1.raw({description: "OptDesc"});
        const manifest1: any = builder1.build();
        expect(manifest1.description).toBe("Desc");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({description: "OptDesc"});
        const manifest2: any = builder2.build();
        expect(manifest2.description).toBe("OptDesc");

        const builder3 = new ManifestV3(Browser.Chrome);
        const manifest3: any = builder3.build();
        expect(manifest3.description).toBeUndefined();
    });

    it("version", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setVersion("1.2.3");
        builder1.raw({version: "9.9.9"});
        const manifest1: any = builder1.build();
        expect(manifest1.version).toBe("1.2.3");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({version: "9.9.9"});
        const manifest2: any = builder2.build();
        expect(manifest2.version).toBe("9.9.9");

        const builder3 = new ManifestV3(Browser.Chrome);
        const manifest3: any = builder3.build();
        expect(manifest3.version).toBe("0.0.0");
    });

    it("minimum_chrome_version", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setMinimumVersion("120.0.0");
        builder1.raw({minimum_chrome_version: "100.0.0"});
        const manifest1: any = builder1.build();
        expect(manifest1.minimum_chrome_version).toBe("120.0.0");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({minimum_chrome_version: "100.0.0"});
        const manifest2: any = builder2.build();
        expect(manifest2.minimum_chrome_version).toBe("100.0.0");

        const builder3 = new ManifestV3(Browser.Chrome);
        const manifest3: any = builder3.build();
        expect(manifest3.minimum_chrome_version).toBeUndefined();
    });

    it("author", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setAuthor("AddonBone");
        const manifest1: any = builder1.build();
        expect(manifest1.author).toBe("AddonBone");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({author: "Opt"});
        const manifest2: any = builder2.build();
        expect(manifest2.author).toBe("Opt");

        const builder3 = new ManifestV3(Browser.Chrome);
        const manifest3: any = builder3.build();
        expect(manifest3.author).toBeUndefined();
    });

    it("homepage_url", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setHomepage("https://me.example");
        const manifest1: any = builder1.build();
        expect(manifest1.homepage_url).toBe("https://me.example");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({homepage_url: "https://opt.example"});
        const manifest2: any = builder2.build();
        expect(manifest2.homepage_url).toBe("https://opt.example");

        const builder3 = new ManifestV3(Browser.Chrome);
        const manifest3: any = builder3.build();
        expect(manifest3.homepage_url).toBeUndefined();
    });

    it("incognito", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setIncognito("not_allowed" as any);
        const manifest1: any = builder1.build();
        expect(manifest1.incognito).toBe("not_allowed");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({incognito: "split"});
        const manifest2: any = builder2.build();
        expect(manifest2.incognito).toBe("split");

        const builder3 = new ManifestV3(Browser.Chrome);
        const manifest3: any = builder3.build();
        expect(manifest3.incognito).toBeUndefined();
    });

    it("default_locale", () => {
        const builder1 = new ManifestV3(Browser.Chrome);
        builder1.setLocale("en" as any);
        const manifest1: any = builder1.build();
        expect(manifest1.default_locale).toBe("en");

        const builder2 = new ManifestV3(Browser.Chrome);
        builder2.raw({default_locale: "uk"});
        const manifest2: any = builder2.build();
        expect(manifest2.default_locale).toBe("uk");

        const builder3 = new ManifestV3(Browser.Chrome);
        const manifest3: any = builder3.build();
        expect(manifest3.default_locale).toBeUndefined();
    });
});

describe("ManifestBase sandbox properties", () => {
    test("builds MV3 sandbox pages and content security policy", () => {
        const builder = new ManifestV3(Browser.Chrome);

        builder
            .raw({
                sandbox: {pages: ["sandbox/raw.html"]},
                content_security_policy: {
                    extension_pages: "script-src 'self'; object-src 'self';",
                    sandbox: "sandbox allow-scripts; script-src 'self';",
                },
            } as any)
            .appendSandboxes(["sandbox/parser.html", "sandbox/parser.html"])
            .setSandboxContentSecurityPolicy("sandbox allow-scripts; script-src 'self' 'unsafe-eval';");

        const manifest: any = builder.build();

        expect(manifest.sandbox.pages).toEqual(["sandbox/raw.html", "sandbox/parser.html"]);
        expect(manifest.content_security_policy.extension_pages).toBe("script-src 'self'; object-src 'self';");
        expect(manifest.content_security_policy.sandbox).toBe(
            "sandbox allow-scripts; script-src 'self' 'unsafe-eval';"
        );
    });

    test("builds MV2 sandbox content security policy inside the sandbox object", () => {
        const builder = new ManifestV2(Browser.Chrome);

        builder
            .raw({
                sandbox: {
                    pages: ["sandbox/raw.html"],
                    content_security_policy: "sandbox allow-scripts; script-src 'self';",
                },
            } as any)
            .addSandbox("sandbox/parser.html")
            .setSandboxContentSecurityPolicy("sandbox allow-scripts; script-src 'self' 'unsafe-eval';");

        const manifest: any = builder.build();

        expect(manifest.sandbox.pages).toEqual(["sandbox/raw.html", "sandbox/parser.html"]);
        expect(manifest.sandbox.content_security_policy).toBe(
            "sandbox allow-scripts; script-src 'self' 'unsafe-eval';"
        );
    });

    test("does not emit sandbox manifest fields for Firefox MV3", () => {
        const builder = new ManifestV3(Browser.Firefox);

        builder
            .raw({
                sandbox: {pages: ["sandbox/raw.html"]},
                content_security_policy: {
                    extension_pages: "script-src 'self'; object-src 'self';",
                    sandbox: "sandbox allow-scripts; script-src 'self';",
                },
            } as any)
            .appendSandboxes(["sandbox/parser.html"])
            .setSandboxContentSecurityPolicy("sandbox allow-scripts; script-src 'self' 'unsafe-eval';");

        const manifest: any = builder.build();

        expect(manifest.sandbox).toBeUndefined();
        expect(manifest.content_security_policy).toEqual({
            extension_pages: "script-src 'self'; object-src 'self';",
        });
    });

    test("does not emit sandbox manifest fields for Firefox MV2", () => {
        const builder = new ManifestV2(Browser.Firefox);

        builder
            .raw({
                sandbox: {
                    pages: ["sandbox/raw.html"],
                    content_security_policy: "sandbox allow-scripts; script-src 'self';",
                },
            } as any)
            .addSandbox("sandbox/parser.html")
            .setSandboxContentSecurityPolicy("sandbox allow-scripts; script-src 'self' 'unsafe-eval';");

        const manifest: any = builder.build();

        expect(manifest.sandbox).toBeUndefined();
    });
});

describe("ManifestBase merged properties", () => {
    it("merging objects and arrays", () => {
        const builder = new ManifestV3(Browser.Chrome);

        builder
            .raw({permissions: ["tabs"]})
            .raw({permissions: ["storage"]})
            .raw({commands: {cmd1: {description: "First"}}})
            .raw({commands: {cmd2: {description: "Second"}}});

        const manifest: any = builder.build();

        expect(manifest.permissions).toEqual(expect.arrayContaining(["tabs", "storage"]));
        expect(manifest.commands).toEqual(
            expect.objectContaining({
                cmd1: {description: "First"},
                cmd2: {description: "Second"},
            })
        );
    });

    it("commands", () => {
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

    it("content_scripts", () => {
        const builder = new ManifestV3(Browser.Chrome);

        builder
            .setDependencies(
                new Map([
                    [
                        "entry",
                        {
                            js: new Set(["entry.js"]),
                            css: new Set(["entry.css"]),
                            assets: new Set(["entry.png"]),
                        },
                    ],
                ])
            )
            .setContentScripts(
                new Set([
                    {
                        matches: ["https://internal.com/*"],
                        entry: "entry",
                    },
                ])
            );

        builder.raw({
            content_scripts: [
                {
                    matches: ["https://raw.com/*"],
                    js: ["raw.js"],
                    css: ["raw.css"],
                },
            ],
        });

        const contentScripts: any = builder.build().content_scripts;

        expect(contentScripts).toBeDefined();
        expect(contentScripts.length).toBe(2);
    });

    it("icons", () => {
        const builder = new ManifestV3(Browser.Chrome);

        builder.setIcons(
            new Map([
                [
                    "default",
                    new Map([
                        [16, "internal16.png"],
                        [24, "internal24.png"],
                    ]),
                ],
            ])
        );

        builder.raw({icons: {16: "raw16.png", 32: "raw32.png"}});

        const icons: any = builder.build().icons;

        expect(icons["16"]).toBe("internal16.png");
        expect(icons["24"]).toBe("internal24.png");
        expect(icons["32"]).toBe("raw32.png");
    });

    it("permissions", () => {
        const builder_v3 = new ManifestV3(Browser.Chrome);
        builder_v3.appendPermissions(new Set(["storage", "activeTab"])).raw({
            permissions: ["tabs"],
            host_permissions: ["https://api.example.com/*"],
        });
        const manifest_v3: any = builder_v3.build();
        expect(manifest_v3.host_permissions).toEqual(expect.arrayContaining(["https://api.example.com/*"]));
        expect(manifest_v3.permissions).toEqual(expect.arrayContaining(["storage", "tabs"]));

        const builder_v2 = new ManifestV2(Browser.Chrome);
        builder_v2
            .addPermission("storage")
            .addHostPermission("https://*.example.com/*")
            .raw({
                permissions: ["tabs", "activeTab"],
                host_permissions: ["https://api.example.com/*"],
            });
        const manifest_v2: any = builder_v2.build();
        expect(manifest_v2.host_permissions).toBeUndefined();
        expect(manifest_v2.permissions).toEqual(
            expect.arrayContaining(["storage", "tabs", "https://*.example.com/*", "https://api.example.com/*"])
        );
    });

    it("optional_permissions", () => {
        const builder_v3 = new ManifestV3(Browser.Chrome);
        builder_v3
            .addPermission("storage")
            .addOptionalPermission("bookmarks")
            .raw({optional_permissions: ["history", "storage"]});
        const manifest_v3: any = builder_v3.build();
        expect(manifest_v3.optional_permissions).toEqual(expect.arrayContaining(["bookmarks", "history"]));
        expect(manifest_v3.optional_permissions).not.toEqual(expect.arrayContaining(["storage"]));

        // MV2: optional_permissions also include optional host permissions not already in host permissions
        const builder_v2 = new ManifestV2(Browser.Chrome);
        builder_v2
            .addPermission("storage")
            .addHostPermission("https://*.example.com/*")
            .setOptionalPermissions(new Set(["bookmarks"]))
            .setOptionalHostPermissions(new Set(["https://opt.example.com/*", "https://*.example.com/*"]))
            .raw({optional_permissions: ["history"]});
        const manifest_v2: any = builder_v2.build();
        expect(manifest_v2.optional_permissions).toEqual(
            expect.arrayContaining(["bookmarks", "history", "https://opt.example.com/*"])
        );
        expect(manifest_v2.optional_permissions).not.toEqual(expect.arrayContaining(["https://*.example.com/*"]));
    });

    it("host_permissions", () => {
        const builder_v3 = new ManifestV3(Browser.Chrome);
        builder_v3.addHostPermission("https://*.example.com/*").raw({host_permissions: ["https://api.example.com/*"]});
        const manifest_v3: any = builder_v3.build();
        expect(manifest_v3.host_permissions).toEqual(
            expect.arrayContaining(["https://*.example.com/*", "https://api.example.com/*"])
        );

        const builder_v2 = new ManifestV2(Browser.Chrome);
        builder_v2.addHostPermission("https://*.example.com/*").raw({host_permissions: ["https://api.example.com/*"]});
        const manifest_v2: any = builder_v2.build();
        expect(manifest_v2.host_permissions).toBeUndefined();
        expect(manifest_v2.permissions).toEqual(
            expect.arrayContaining(["https://*.example.com/*", "https://api.example.com/*"])
        );
    });

    it("optional_host_permissions", () => {
        const builder_v3 = new ManifestV3(Browser.Chrome);
        builder_v3
            .addHostPermission("https://*.example.com/*")
            .setOptionalHostPermissions(new Set(["https://opt.example.com/*", "https://*.example.com/*"])) // duplicated one should be filtered out
            .raw({optional_host_permissions: ["https://raw-opt.example.com/*"]});
        const manifest_v3: any = builder_v3.build();
        expect(manifest_v3.optional_host_permissions).toEqual(
            expect.arrayContaining(["https://opt.example.com/*", "https://raw-opt.example.com/*"])
        );
        expect(manifest_v3.optional_host_permissions).not.toEqual(expect.arrayContaining(["https://*.example.com/*"]));

        const builder_v2 = new ManifestV2(Browser.Chrome);
        builder_v2
            .addHostPermission("https://*.example.com/*")
            .setOptionalHostPermissions(new Set(["https://opt.example.com/*"]));
        const manifest_v2: any = builder_v2.build();
        expect(manifest_v2.optional_host_permissions).toBeUndefined();
        expect(manifest_v2.optional_permissions).toEqual(expect.arrayContaining(["https://opt.example.com/*"]));
    });

    it("web_accessible_resources (MV3)", () => {
        const builder = new ManifestV3(Browser.Chrome);

        builder
            .setDependencies(
                new Map([
                    [
                        "entry",
                        {
                            js: new Set(["entry.js"]),
                            css: new Set<string>(),
                            assets: new Set(["img/a.png", "img/b.png"]),
                        },
                    ],
                    [
                        "entry2",
                        {
                            js: new Set(["entry2.js"]),
                            css: new Set<string>(),
                            assets: new Set(["img/b.png", "img/c.png"]),
                        },
                    ],
                ])
            )
            .setContentScripts(
                new Set([
                    {
                        matches: ["https://site.com/*"],
                        entry: "entry",
                    },
                    {
                        matches: ["https://other.com/*"],
                        entry: "entry2",
                    },
                ])
            )
            .addAccessibleResource({resources: ["img/common.png"], matches: ["https://site.com/*"]})
            .raw({
                web_accessible_resources: [
                    {resources: ["img/raw.png", "img/a.png"], matches: ["https://site.com/*"]},
                    {resources: ["img/onlyraw.png"], matches: ["https://other.com/*"]},
                ],
            });

        const resources: any[] = builder.build().web_accessible_resources as any[];
        expect(Array.isArray(resources)).toBe(true);

        const byMatches = (pattern: string) => resources.find(r => (r.matches || []).includes(pattern));

        const site = byMatches("https://site.com/*");
        expect(site).toBeDefined();
        expect(site.resources).toEqual(
            expect.arrayContaining([
                "img/a.png", // from deps + raw
                "img/b.png", // from deps
                "img/common.png", // internal
                "img/raw.png", // raw only
            ])
        );

        const other = byMatches("https://other.com/*");
        expect(other).toBeDefined();
        expect(other.resources).toEqual(
            expect.arrayContaining([
                "img/b.png", // from entry2 deps
                "img/c.png", // from entry2 deps
                "img/onlyraw.png", // raw only
            ])
        );

        // Ensure no duplicates overall within each group
        expect(unique(site.resources)).toBe(true);
        expect(unique(other.resources)).toBe(true);
    });

    it("web_accessible_resources (MV2)", () => {
        const builder = new ManifestV2(Browser.Chrome);

        builder
            .setDependencies(
                new Map([
                    [
                        "entry",
                        {
                            js: new Set(["entry.js"]),
                            css: new Set<string>(),
                            assets: new Set(["img/a.png", "img/b.png"]),
                        },
                    ],
                    [
                        "entry2",
                        {
                            js: new Set(["entry2.js"]),
                            css: new Set<string>(),
                            assets: new Set(["img/b.png", "img/c.png"]),
                        },
                    ],
                ])
            )
            .setContentScripts(
                new Set([
                    {matches: ["https://site.com/*"], entry: "entry"},
                    {matches: ["https://other.com/*"], entry: "entry2"},
                ])
            )
            .addAccessibleResource({resources: ["img/common.png"], matches: ["https://site.com/*"]})
            .raw({
                web_accessible_resources: [
                    {resources: ["img/raw.png", "img/a.png"], matches: ["https://site.com/*"]},
                    {resources: ["img/onlyraw.png"], matches: ["https://other.com/*"]},
                ],
            });

        const resources: any[] = (builder.build() as any).web_accessible_resources;
        expect(Array.isArray(resources)).toBe(true);

        // MV2 flattens to unique list of strings
        expect(resources).toEqual(
            expect.arrayContaining([
                "img/a.png",
                "img/b.png",
                "img/c.png",
                "img/common.png",
                "img/raw.png",
                "img/onlyraw.png",
            ])
        );

        // Ensure uniqueness

        expect(unique(resources)).toBe(true);
    });
});

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

        builder.raw({
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

    it("should use raw for gecko settings when specific is not set", () => {
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
        expect(settings.gecko.data_collection_permissions.required).toContain(DataCollectionPermission.WebsiteActivity);
        expect(settings.gecko.data_collection_permissions.required).toContain(
            DataCollectionPermission.BrowsingActivity
        );
        expect(settings.gecko_android.strict_min_version).toBe("110.0");
        expect(settings.gecko_android.strict_max_version).toBe("119.0");
    });
});
