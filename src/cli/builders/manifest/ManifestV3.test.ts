import ManifestV3 from "./ManifestV3";
import {Browser} from "@typing/browser";
import {CommandExecuteActionName} from "@typing/command";

const unique = (arr: string[]) => Array.from(new Set(arr)).length === arr.length;

const dependency = (js: string[] = [], css: string[] = [], assets: string[] = []) => ({
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
            })
            .build();

        const resources: any[] = manifest.web_accessible_resources;
        const byMatches = (pattern: string) => resources.find(r => (r.matches || []).includes(pattern));
        const site = byMatches("https://site.com/*");
        const other = byMatches("https://other.com/*");

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
