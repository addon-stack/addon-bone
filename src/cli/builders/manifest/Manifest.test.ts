import ManifestV2 from "./ManifestV2";
import ManifestV3 from "./ManifestV3";
import {Browser, DataCollectionPermission} from "@typing/browser";
import {CommandExecuteActionName} from "@typing/command";
import type {ActionOptions} from "@typing/action";
import {Language} from "@typing/locale";
import {ManifestIncognito, type ManifestPopup, type OptionalManifest} from "@typing/manifest";

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

    describe.each([
        {version: 2, Builder: ManifestV2},
        {version: 3, Builder: ManifestV3},
    ])("MV$version raw updates", ({Builder}) => {
        it("merges later raw fields after reading the manifest", () => {
            const builder = new Builder(Browser.Chrome).raw({
                version_name: "before",
                commands: {open: {description: "Before", suggested_key: {default: "Ctrl+Shift+U"}}},
                externally_connectable: {matches: ["https://before.example/*"]},
            });

            expect(builder.get().version_name).toBe("before");

            builder.raw({
                version_name: "after",
                commands: {open: {description: "After", suggested_key: {mac: "Command+Shift+U"}}},
                externally_connectable: {matches: ["https://after.example/*"]},
            });

            const manifest = builder.get();

            expect(manifest).toMatchObject({
                version_name: "after",
                commands: {
                    open: {
                        description: "After",
                        suggested_key: {default: "Ctrl+Shift+U", mac: "Command+Shift+U"},
                    },
                },
                externally_connectable: {matches: ["https://before.example/*", "https://after.example/*"]},
            });

            expect(builder.get()).toEqual(manifest);
        });

        it("restores raw commands after clearing internal commands", () => {
            const rawCommands = {
                shared: {
                    description: "Raw description",
                    suggested_key: {default: "Ctrl+Shift+Y", mac: "Command+Shift+Y"},
                },
            };

            const builder = new Builder(Browser.Chrome)
                .raw({commands: rawCommands})
                .setCommands(
                    new Set([
                        {name: "shared", description: "Internal description", macKey: "Command+Shift+U"},
                        {name: "temporary"},
                    ])
                );

            expect(builder.get().commands).toMatchObject({
                shared: {
                    description: "Internal description",
                    suggested_key: {default: "Ctrl+Shift+Y", mac: "Command+Shift+U"},
                },
                temporary: {description: "temporary"},
            });

            builder.setCommands();

            expect(builder.get().commands).toEqual(rawCommands);
        });

        it("includes raw fields after reading web accessible resources", () => {
            const builder = new Builder(Browser.Chrome);

            expect(builder.getWebAccessibleResources()).toEqual([]);

            builder.raw({version_name: "after"});

            expect(builder.get().version_name).toBe("after");
        });
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

describe.each([
    {version: 2, Builder: ManifestV2, actionCommand: "_execute_browser_action"},
    {version: 3, Builder: ManifestV3, actionCommand: "_execute_action"},
] as const)("MV$version commands", ({Builder, actionCommand}) => {
    it("preserves command options and ordinary names without changing the internal action name", () => {
        const command = Object.freeze({
            name: CommandExecuteActionName,
            defaultKey: "Ctrl+Shift+1",
            windowsKey: "Ctrl+Shift+2",
            macKey: "Ctrl+Shift+3",
            chromeosKey: "Ctrl+Shift+4",
            linuxKey: "Ctrl+Shift+5",
            description: "Run the action",
            global: true,
        });

        const manifest = new Builder(Browser.Chrome)
            .setCommands(
                new Set([
                    command,
                    {
                        name: "open-settings",
                        defaultKey: "Ctrl+Shift+S",
                        macKey: "Command+Shift+S",
                        description: "Open settings",
                        global: false,
                    },
                ])
            )
            .build();

        expect(manifest.commands).toEqual({
            [actionCommand]: {
                suggested_key: {
                    default: "Ctrl+Shift+1",
                    windows: "Ctrl+Shift+2",
                    mac: "Ctrl+Shift+3",
                    chromeos: "Ctrl+Shift+4",
                    linux: "Ctrl+Shift+5",
                },
                description: "Run the action",
                global: true,
            },
            "open-settings": {
                suggested_key: {default: "Ctrl+Shift+S", mac: "Command+Shift+S"},
                description: "Open settings",
                global: false,
            },
        });
        expect(command.name).toBe("_execute_action");
    });
});

describe.each([
    {version: 2, Builder: ManifestV2, field: "browser_action"},
    {version: 3, Builder: ManifestV3, field: "action"},
] as const)("MV$version toolbar action", ({Builder, field}) => {
    const createBuilder = () =>
        new Builder(Browser.Chrome)
            .setName("Extension")
            .setIcon("extension")
            .setIcons(
                new Map([
                    ["default", new Map([[16, "icons/default.png"]])],
                    ["extension", new Map([[16, "icons/extension.png"]])],
                    ["action", new Map([[16, "icons/action.png"]])],
                    ["popup", new Map([[16, "icons/popup.png"]])],
                ])
            );

    it("does not declare a button for extension metadata or ordinary commands alone", () => {
        const manifest = createBuilder()
            .setCommands(new Set([{name: "open-settings", description: "Open settings"}]))
            .build();

        expect(manifest).not.toHaveProperty(field);
        expect(manifest.icons).toEqual({16: "icons/extension.png"});
    });

    it("declares configured appearance without a popup, command or background", () => {
        const manifest = createBuilder().setAction({icon: "action", title: "Action"}).build();

        expect(manifest).toHaveProperty(field, {
            default_icon: {16: "icons/action.png"},
            default_title: "Action",
        });
        expect(manifest).not.toHaveProperty(`${field}.default_popup`);
        expect(manifest).not.toHaveProperty("commands");
        expect(manifest).not.toHaveProperty("background");
        expect(manifest.icons).toEqual({16: "icons/extension.png"});
    });

    it("uses extension defaults for an explicit empty action", () => {
        expect(createBuilder().setAction({}).build()).toHaveProperty(field, {
            default_icon: {16: "icons/extension.png"},
            default_title: "Extension",
        });
    });

    it("uses extension defaults for an execute-action command", () => {
        const manifest = createBuilder()
            .setCommands(new Set([{name: CommandExecuteActionName}]))
            .build();

        expect(manifest).toHaveProperty(field, {
            default_icon: {16: "icons/extension.png"},
            default_title: "Extension",
        });
    });

    it("uses configured appearance with an execute-action command", () => {
        const manifest = createBuilder()
            .setCommands(new Set([{name: CommandExecuteActionName}]))
            .setAction({icon: "action", title: "Action"})
            .build();

        expect(manifest).toHaveProperty(field, {
            default_icon: {16: "icons/action.png"},
            default_title: "Action",
        });
    });

    it.each([
        {options: {}, title: "Action", icon: "action"},
        {options: {title: "Popup"}, title: "Popup", icon: "action"},
        {options: {icon: "popup"}, title: "Action", icon: "popup"},
        {options: {title: "Popup", icon: "popup"}, title: "Popup", icon: "popup"},
    ])("overrides popup fields independently: $options", ({options, title, icon}) => {
        const action: ActionOptions = {icon: "action", title: "Action"};
        const popup: ManifestPopup = {path: "popup.html", ...options};

        const before = createBuilder().setAction(action).setPopup(popup).build();
        const after = createBuilder().setPopup(popup).setAction(action).build();

        expect(before).toHaveProperty(field, {
            default_icon: {16: `icons/${icon}.png`},
            default_title: title,
            default_popup: "popup.html",
        });
        expect(after).toEqual(before);
    });

    it("uses extension defaults when the popup has no appearance overrides", () => {
        expect(createBuilder().setPopup({path: "popup.html"}).build()).toHaveProperty(field, {
            default_icon: {16: "icons/extension.png"},
            default_title: "Extension",
            default_popup: "popup.html",
        });
    });

    it("preserves an explicitly empty tooltip", () => {
        expect(createBuilder().setAction({title: ""}).build()).toHaveProperty(`${field}.default_title`, "");
    });

    it("can declare a button without available icons", () => {
        const manifest = new Builder(Browser.Chrome).setName("Extension").setAction({}).build();

        expect(manifest).toHaveProperty(field, {default_title: "Extension"});
    });

    it("keeps the existing default-group fallback for unknown icon groups", () => {
        const manifest = createBuilder().setAction({icon: "missing"}).build();

        expect(manifest).toHaveProperty(`${field}.default_icon`, {16: "icons/default.png"});
    });

    it("clears popup overrides and explicit action settings without retaining stale data", () => {
        const builder = createBuilder()
            .setAction({icon: "action", title: "Action"})
            .setPopup({path: "popup.html", icon: "popup", title: "Popup"});

        expect(builder.build()).toHaveProperty(`${field}.default_title`, "Popup");

        builder.setPopup(undefined);

        expect(builder.build()).toHaveProperty(field, {
            default_icon: {16: "icons/action.png"},
            default_title: "Action",
        });

        builder.setAction(undefined);

        expect(builder.build()).not.toHaveProperty(field);
    });
});

describe.each([
    ["ManifestV2", ManifestV2],
    ["ManifestV3", ManifestV3],
] as const)("%s options page", (_, Builder) => {
    describe.each([Browser.Chrome, Browser.Edge, Browser.Opera, Browser.Safari, Browser.Firefox])("%s", browser => {
        const rawOptionsUi = {
            page: "raw-options.html",
            open_in_tab: false,
            browser_style: true,
            chrome_style: true,
        };
        const rawOptions = {
            options_ui: rawOptionsUi,
            options_page: "legacy-options.html",
        };
        const rawCases: {name: string; raw: OptionalManifest}[] = [
            {name: "options_ui", raw: {options_ui: rawOptionsUi}},
            {name: "options_page", raw: {options_page: "legacy-options.html"}},
            {name: "both options keys", raw: rawOptions},
        ];

        it("defaults the generated options page to a browser tab", () => {
            const manifest = new Builder(browser).setOptions({path: "options.html"}).build();

            expect(manifest.options_ui).toStrictEqual({page: "options.html", open_in_tab: true});
            expect(manifest).not.toHaveProperty("options_page");
        });

        it.each([true, false])("preserves explicit openInTab=%s", openInTab => {
            const manifest = new Builder(browser).setOptions({path: "options.html", openInTab}).build();

            expect(manifest.options_ui).toStrictEqual({page: "options.html", open_in_tab: openInTab});
        });

        it.each(rawCases)("preserves raw $name without an options entrypoint", ({raw}) => {
            const manifest = new Builder(browser).raw(raw).build();

            expect(manifest.options_ui).toStrictEqual(raw.options_ui);
            expect(manifest.options_page).toBe(raw.options_page);
        });

        it("replaces both raw options keys with only the generated page and open_in_tab", () => {
            const manifest = new Builder(browser).setOptions({path: "options.html"}).raw(rawOptions).build();

            expect(manifest.options_ui).toStrictEqual({page: "options.html", open_in_tab: true});
            expect(manifest).not.toHaveProperty("options_page");
        });

        it("restores both raw options keys after clearing a generated options page", () => {
            const builder = new Builder(browser).raw(rawOptions).setOptions({path: "options.html"});

            builder.build();
            const manifest = builder.setOptions(undefined).build();

            expect(manifest.options_ui).toStrictEqual(rawOptions.options_ui);
            expect(manifest.options_page).toBe(rawOptions.options_page);
        });

        it("omits both options keys when there is no options page", () => {
            const manifest = new Builder(browser).build();

            expect(manifest).not.toHaveProperty("options_ui");
            expect(manifest).not.toHaveProperty("options_page");
        });

        it("omits both options keys after clearing an options page without raw fallback", () => {
            const builder = new Builder(browser).setOptions({path: "options.html", openInTab: false});

            builder.build();
            const manifest = builder.setOptions(undefined).build();

            expect(manifest).not.toHaveProperty("options_ui");
            expect(manifest).not.toHaveProperty("options_page");
        });
    });
});

describe.each([
    ["ManifestV2", ManifestV2],
    ["ManifestV3", ManifestV3],
] as const)("%s override page", (_, Builder) => {
    describe.each([Browser.Chrome, Browser.Edge, Browser.Opera, Browser.Safari, Browser.Firefox])("%s", browser => {
        const rawOverrides = {bookmarks: "raw-bookmarks.html", history: "raw-history.html"};

        it.each(["newtab", "bookmarks", "history"] as const)("writes the generated %s override under its key", page => {
            const manifest = new Builder(browser).setOverride({page, path: `${page}.html`}).build();

            expect(manifest.chrome_url_overrides).toStrictEqual({[page]: `${page}.html`});
        });

        it("preserves raw chrome_url_overrides without an override entrypoint", () => {
            const manifest = new Builder(browser).raw({chrome_url_overrides: rawOverrides}).build();

            expect(manifest.chrome_url_overrides).toStrictEqual(rawOverrides);
        });

        it("replaces raw chrome_url_overrides with only the generated page", () => {
            const manifest = new Builder(browser)
                .setOverride({page: "newtab", path: "newtab.html"})
                .raw({chrome_url_overrides: rawOverrides})
                .build();

            expect(manifest.chrome_url_overrides).toStrictEqual({newtab: "newtab.html"});
        });

        it("restores raw chrome_url_overrides after clearing a generated override", () => {
            const builder = new Builder(browser)
                .raw({chrome_url_overrides: rawOverrides})
                .setOverride({page: "newtab", path: "newtab.html"});

            builder.build();
            const manifest = builder.setOverride(undefined).build();

            expect(manifest.chrome_url_overrides).toStrictEqual(rawOverrides);
        });

        it("omits chrome_url_overrides when there is no override page", () => {
            const manifest = new Builder(browser).build();

            expect(manifest).not.toHaveProperty("chrome_url_overrides");
        });

        it("omits chrome_url_overrides after clearing an override without raw fallback", () => {
            const builder = new Builder(browser).setOverride({page: "history", path: "history.html"});

            builder.build();
            const manifest = builder.setOverride(undefined).build();

            expect(manifest).not.toHaveProperty("chrome_url_overrides");
        });
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
