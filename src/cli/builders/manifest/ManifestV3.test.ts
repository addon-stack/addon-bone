import ManifestV3 from "./ManifestV3";
import {Browser} from "@typing/browser";
import {CommandExecuteActionName} from "@typing/command";
import type {ManifestDependency} from "@typing/manifest";

const unique = (arr: string[]) => Array.from(new Set(arr)).length === arr.length;

const dependency = (js: string[] = [], css: string[] = [], assets: string[] = []): ManifestDependency => ({
    js: new Set(js),
    css: new Set(css),
    assets: new Set(assets),
});

describe("ManifestV3", () => {
    it("returns manifest version 3", () => {
        expect(new ManifestV3(Browser.Chrome).getManifestVersion()).toBe(3);
        expect((new ManifestV3(Browser.Chrome).build() as any).manifest_version).toBe(3);
    });

    it("builds service worker background from dependencies", () => {
        const manifest: any = new ManifestV3(Browser.Chrome)
            .setDependencies(new Map([["background", dependency(["background.js"])]]))
            .setBackground({entry: "background"})
            .build();

        expect(manifest.background).toEqual({service_worker: "background.js"});
    });

    it("builds Firefox background scripts without persistent", () => {
        const manifest: any = new ManifestV3(Browser.Firefox)
            .setDependencies(new Map([["background", dependency(["background.js"])]]))
            .setBackground({entry: "background", persistent: true})
            .build();

        expect(manifest.background).toEqual({scripts: ["background.js"], persistent: undefined});
    });

    it("builds action from popup and selected icons", () => {
        const manifest: any = new ManifestV3(Browser.Chrome)
            .setName("Popup Addon")
            .setIcons(new Map([["popup", new Map([[16, "popup16.png"]])]]))
            .setPopup({path: "popup.html", title: "Popup", icon: "popup"})
            .build();

        expect(manifest.action).toEqual({
            default_title: "Popup",
            default_popup: "popup.html",
            default_icon: {16: "popup16.png"},
        });
    });

    it("builds action for execute action commands", () => {
        const manifest: any = new ManifestV3(Browser.Chrome)
            .setName("Command Addon")
            .setCommands(new Set([{name: CommandExecuteActionName}]))
            .build();

        expect(manifest.action).toEqual({default_title: "Command Addon"});
    });

    it("builds side_panel for Chrome and sidebar_action for alternative browsers", () => {
        const chrome: any = new ManifestV3(Browser.Chrome).setSidebar({path: "sidebar.html", title: "Sidebar"}).build();
        const firefox: any = new ManifestV3(Browser.Firefox)
            .setSidebar({path: "sidebar.html", title: "Sidebar"})
            .build();

        expect(chrome.side_panel.default_path).toBe("sidebar.html");
        expect(chrome.side_panel.default_title).toBe("Sidebar");
        expect(firefox.sidebar_action.default_panel).toBe("sidebar.html");
        expect(firefox.sidebar_action.open_at_install).toBe(false);
    });

    it("builds MV3 content scripts with MV3-only options", () => {
        const manifest: any = new ManifestV3(Browser.Chrome)
            .setDependencies(new Map([["content", dependency(["content.js"], ["content.css"])]]))
            .setContentScripts(
                new Set([
                    {
                        entry: "content",
                        matches: ["https://example.com/*"],
                        world: "MAIN" as any,
                        matchOriginAsFallback: true,
                        matchAboutBlank: true,
                    },
                ])
            )
            .build();

        expect(manifest.content_scripts[0]).toEqual({
            matches: ["https://example.com/*"],
            exclude_matches: undefined,
            js: ["content.js"],
            css: ["content.css"],
            all_frames: undefined,
            run_at: undefined,
            exclude_globs: undefined,
            include_globs: undefined,
            match_about_blank: true,
            match_origin_as_fallback: true,
            world: "MAIN",
        });
    });

    it("uses prepared CSS lists and exposes runtime resources without interpreting their delivery policy", () => {
        const manifest: any = new ManifestV3(Browser.Chrome)
            .setDependencies(
                new Map([
                    ["shadow", dependency(["shadow.js"], ["page.css"], ["lazy.css", "shared.css", "shadow.css"])],
                    ["normal", dependency(["normal.js"], ["shared.css"], ["normal-lazy.css"])],
                ])
            )
            .setContentScripts(
                new Set([
                    {entry: "shadow", matches: ["https://example.com/*"]},
                    {entry: "normal", matches: ["https://example.com/*"]},
                ])
            )
            .build();

        expect(manifest.content_scripts).toEqual(
            expect.arrayContaining([
                expect.objectContaining({js: ["shadow.js"], css: ["page.css"]}),
                expect.objectContaining({js: ["normal.js"], css: ["shared.css"]}),
            ])
        );
        expect(manifest.web_accessible_resources[0].resources).toEqual(
            expect.arrayContaining(["lazy.css", "normal-lazy.css", "shared.css", "shadow.css"])
        );
    });

    it("builds permissions separately from host permissions", () => {
        const manifest: any = new ManifestV3(Browser.Chrome)
            .setPermissions(new Set(["storage"]))
            .appendPermissions(new Set(["tabs"]))
            .addPermission("activeTab")
            .setHostPermissions(new Set(["https://set.example.com/*"]))
            .appendHostPermissions(new Set(["https://append.example.com/*"]))
            .addHostPermission("https://add.example.com/*")
            .raw({
                permissions: ["bookmarks"],
                host_permissions: ["https://raw.example.com/*"],
            })
            .build();

        expect(manifest.permissions).toEqual(expect.arrayContaining(["storage", "tabs", "bookmarks"]));
        expect(manifest.host_permissions).toEqual(
            expect.arrayContaining([
                "https://set.example.com/*",
                "https://append.example.com/*",
                "https://add.example.com/*",
                "https://raw.example.com/*",
            ])
        );
    });

    it("builds optional permissions separately from optional host permissions", () => {
        const manifest: any = new ManifestV3(Browser.Chrome)
            .setPermissions(new Set(["storage"]))
            .setHostPermissions(new Set(["https://required.example.com/*"]))
            .setOptionalPermissions(new Set(["bookmarks"]))
            .appendOptionalPermissions(new Set(["history", "storage"]))
            .addOptionalPermission("downloads")
            .setOptionalHostPermissions(new Set(["https://optional.example.com/*"]))
            .appendOptionalHostPermissions(new Set(["https://required.example.com/*"]))
            .addOptionalHostPermission("https://add-optional.example.com/*")
            .raw({
                optional_permissions: ["sessions"],
                optional_host_permissions: ["https://raw-optional.example.com/*"],
            })
            .build();

        expect(manifest.optional_permissions).toEqual(
            expect.arrayContaining(["bookmarks", "history", "downloads", "sessions"])
        );
        expect(manifest.optional_permissions).not.toEqual(expect.arrayContaining(["storage"]));
        expect(manifest.optional_host_permissions).toEqual(
            expect.arrayContaining([
                "https://optional.example.com/*",
                "https://add-optional.example.com/*",
                "https://raw-optional.example.com/*",
            ])
        );
        expect(manifest.optional_host_permissions).not.toEqual(
            expect.arrayContaining(["https://required.example.com/*"])
        );
    });

    it("removes specific URLs covered by a domain wildcard from combined sources", () => {
        const manifest = new ManifestV3(Browser.Chrome)
            .addHostPermission("https://sub.example.com/file.json")
            .raw({host_permissions: ["https://*.example.com/*"]})
            .build();

        expect(manifest.host_permissions).toEqual(["https://*.example.com/*"]);
    });

    it("removes optional URLs already covered by required host permissions", () => {
        const manifest = new ManifestV3(Browser.Chrome)
            .addHostPermission("https://*.example.com/*")
            .addOptionalHostPermission("https://sub.example.com/file.json")
            .build();

        expect(manifest.host_permissions).toEqual(["https://*.example.com/*"]);
        expect(manifest.optional_host_permissions).toBeUndefined();
    });

    it("simplifies optional hosts while retaining unrelated hosts and schemes", () => {
        const manifest = new ManifestV3(Browser.Chrome)
            .addOptionalHostPermission("https://sub.example.com/file.json")
            .raw({optional_host_permissions: ["https://*.example.com/*"]})
            .addOptionalHostPermission("http://sub.example.com/file.json")
            .addOptionalHostPermission("https://example.org/*")
            .build();

        expect(new Set(manifest.optional_host_permissions)).toEqual(
            new Set(["https://*.example.com/*", "http://sub.example.com/file.json", "https://example.org/*"])
        );
    });

    it("keeps required access when a broader host permission is optional", () => {
        const manifest = new ManifestV3(Browser.Chrome)
            .addHostPermission("https://sub.example.com/file.json")
            .addOptionalHostPermission("https://*.example.com/*")
            .build();

        expect(manifest.host_permissions).toEqual(["https://sub.example.com/file.json"]);
        expect(manifest.optional_host_permissions).toEqual(["https://*.example.com/*"]);
    });

    it.each([Browser.Chrome, Browser.Firefox])(
        "normalizes WAR origins without changing content script paths in %s",
        browser => {
            const matches = ["https://example.com/path/*", "https://sub.example.com/nested/*"];
            const manifest = new ManifestV3(browser)
                .setDependencies(new Map([["entry", dependency(["entry.js"], [], ["file.json"])]]))
                .setContentScripts(new Set([{entry: "entry", matches}]))
                .addAccessibleResource({resources: ["file.json"], matches: ["https://*.example.com/other/*"]})
                .build();

            expect(manifest.content_scripts?.[0].matches).toEqual(matches);
            expect(manifest.web_accessible_resources).toEqual([
                {resources: ["file.json"], matches: ["https://*.example.com/*"]},
            ]);
        }
    );

    it.each([Browser.Chrome, Browser.Firefox])(
        "merges typed and raw WAR fields using native manifest keys in %s",
        browser => {
            const manifest = new ManifestV3(browser)
                .addAccessibleResource({
                    resources: ["a.js"],
                    matches: ["https://example.com/path/*"],
                    extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
                    useDynamicUrl: true,
                })
                .raw({
                    web_accessible_resources: [
                        {
                            resources: ["b.js"],
                            matches: ["https://example.com/nested/*"],
                            extension_ids: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
                            use_dynamic_url: true,
                        },
                        {resources: ["c.js"], matches: ["https://example.org/*"], use_dynamic_url: false},
                    ],
                })
                .build();

            expect(manifest.web_accessible_resources).toEqual([
                {
                    resources: ["a.js", "b.js"],
                    matches: ["https://example.com/*"],
                    extension_ids: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
                    use_dynamic_url: true,
                },
                {resources: ["c.js"], matches: ["https://example.org/*"], use_dynamic_url: false},
            ]);
        }
    );

    it("preserves extension-only access and normalizes wildcard extension IDs", () => {
        const manifest = new ManifestV3(Browser.Chrome)
            .addAccessibleResource({resources: ["a.js"], extensionIds: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]})
            .raw({web_accessible_resources: [{resources: ["a.js"], extension_ids: ["*"]}]})
            .build();

        expect(manifest.web_accessible_resources).toEqual([{resources: ["a.js"], extension_ids: ["*"]}]);
    });

    it("converts legacy resource lists to global access when building MV3", () => {
        const manifest = new ManifestV3(Browser.Chrome)
            .raw({web_accessible_resources: ["a.js", "a.js", "nested/*"]})
            .build();

        expect(manifest.web_accessible_resources).toEqual([
            {resources: ["a.js", "nested/*"], matches: ["<all_urls>"], extension_ids: ["*"]},
        ]);
    });

    it("preserves every origin when raw and generated resources only partially overlap", () => {
        const manifest = new ManifestV3(Browser.Chrome)
            .setDependencies(new Map([["entry", dependency(["entry.js"], [], ["a.js", "b.js"])]]))
            .setContentScripts(new Set([{entry: "entry", matches: ["https://example.com/*", "http://example.org/*"]}]))
            .raw({web_accessible_resources: [{resources: ["a.js"], matches: ["https://*/*"]}]})
            .build();

        expect(manifest.web_accessible_resources).toEqual([
            {resources: ["a.js", "b.js"], matches: ["http://example.org/*", "https://example.com/*"]},
            {resources: ["a.js"], matches: ["https://*/*"]},
        ]);
    });

    it("groups web accessible resources by match patterns", () => {
        const manifest: any = new ManifestV3(Browser.Chrome)
            .setDependencies(
                new Map([
                    ["entry", dependency(["entry.js"], [], ["img/a.png", "img/b.png"])],
                    ["entry2", dependency(["entry2.js"], [], ["img/b.png", "img/c.png"])],
                ])
            )
            .setContentScripts(
                new Set([
                    {matches: ["https://example.com/*"], entry: "entry"},
                    {matches: ["https://example.org/*"], entry: "entry2"},
                ])
            )
            .addAccessibleResource({resources: ["img/common.png"], matches: ["https://example.com/*"]})
            .raw({
                web_accessible_resources: [
                    {resources: ["img/raw.png", "img/a.png"], matches: ["https://example.com/*"]},
                    {resources: ["img/onlyraw.png"], matches: ["https://example.org/*"]},
                ],
            })
            .build();

        const resources: any[] = manifest.web_accessible_resources;
        const byMatches = (pattern: string) => resources.find(r => (r.matches || []).includes(pattern));
        const site = byMatches("https://example.com/*");
        const other = byMatches("https://example.org/*");

        expect(site.resources).toEqual(
            expect.arrayContaining(["img/a.png", "img/b.png", "img/common.png", "img/raw.png"])
        );
        expect(other.resources).toEqual(expect.arrayContaining(["img/b.png", "img/c.png", "img/onlyraw.png"]));
        expect(unique(site.resources)).toBe(true);
        expect(unique(other.resources)).toBe(true);
    });

    it("builds sandbox pages and sandbox content security policy", () => {
        const manifest: any = new ManifestV3(Browser.Chrome)
            .raw({
                sandbox: {pages: ["sandbox/raw.html"]},
                content_security_policy: {
                    extension_pages: "script-src 'self'; object-src 'self';",
                    sandbox: "sandbox allow-scripts; script-src 'self';",
                },
            } as any)
            .appendSandboxes(["sandbox/parser.html", "sandbox/parser.html"])
            .appendSandboxCsp([{eval: true, sources: {}}])
            .build();

        expect(manifest.sandbox.pages).toEqual(["sandbox/raw.html", "sandbox/parser.html"]);
        expect(manifest.content_security_policy.extension_pages).toBe("script-src 'self'; object-src 'self';");
        expect(manifest.content_security_policy.sandbox).toBe(
            "sandbox allow-scripts; script-src 'self' 'unsafe-eval'; child-src 'self';"
        );
    });

    it("does not emit sandbox manifest fields for Firefox", () => {
        const manifest: any = new ManifestV3(Browser.Firefox)
            .raw({
                sandbox: {pages: ["sandbox/raw.html"]},
                content_security_policy: {
                    extension_pages: "script-src 'self'; object-src 'self';",
                    sandbox: "sandbox allow-scripts; script-src 'self';",
                },
            } as any)
            .appendSandboxes(["sandbox/parser.html"])
            .addSandboxCsp({eval: true, sources: {}})
            .build();

        expect(manifest.sandbox).toBeUndefined();
        expect(manifest.content_security_policy).toEqual({
            extension_pages: "script-src 'self'; object-src 'self';",
        });
    });

    it("builds extension page content security policy", () => {
        const manifest: any = new ManifestV3(Browser.Chrome)
            .addCsp({
                wasm: true,
                sources: {
                    connect: ["'self'", "https://api.example.com"],
                    image: ["'self'", "data:"],
                },
            })
            .appendCsp([
                {
                    sources: {
                        image: ["blob:"],
                        worker: ["blob:"],
                    },
                },
            ])
            .build();

        expect(manifest.content_security_policy.extension_pages).toBe(
            "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; connect-src 'self' https://api.example.com; img-src 'self' data: blob:; worker-src blob:;"
        );
    });

    it("keeps Firefox extension page policy and strips sandbox policy", () => {
        const manifest: any = new ManifestV3(Browser.Firefox)
            .raw({
                content_security_policy: {
                    sandbox: "sandbox allow-scripts; script-src 'self';",
                },
            } as any)
            .addCsp({
                sources: {
                    connect: ["https://api.example.com"],
                },
            })
            .build();

        expect(manifest.content_security_policy).toEqual({
            extension_pages: "script-src 'self'; object-src 'self'; connect-src https://api.example.com;",
        });
    });

    it("rejects raw extension_pages when generated CSP is added", () => {
        const builder = new ManifestV3(Browser.Chrome)
            .raw({
                content_security_policy: {
                    extension_pages: "script-src 'self'; object-src 'self';",
                },
            } as any)
            .addCsp({sources: {connect: ["https://api.example.com"]}});

        expect(() => builder.build()).toThrow(
            "Cannot merge extension pages content security policy with raw content_security_policy.extension_pages."
        );
    });
});
