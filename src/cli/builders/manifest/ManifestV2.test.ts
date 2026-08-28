import ManifestV2 from "./ManifestV2";
import {Browser} from "@typing/browser";
import {CommandExecuteActionName} from "@typing/command";

const unique = (arr: string[]) => Array.from(new Set(arr)).length === arr.length;

const dependency = (js: string[] = [], css: string[] = [], assets: string[] = []) => ({
    js: new Set(js),
    css: new Set(css),
    assets: new Set(assets),
});

describe("ManifestV2", () => {
    it("returns manifest version 2", () => {
        expect(new ManifestV2(Browser.Chrome).getManifestVersion()).toBe(2);
        expect((new ManifestV2(Browser.Chrome).build() as any).manifest_version).toBe(2);
    });

    it("builds background scripts from dependencies", () => {
        const manifest: any = new ManifestV2(Browser.Chrome)
            .setDependencies(new Map([["background", dependency(["background.js", "vendor.js"])]]))
            .setBackground({entry: "background", persistent: true})
            .build();

        expect(manifest.background).toEqual({
            scripts: ["background.js", "vendor.js"],
            persistent: true,
        });
    });

    it("builds browser_action from popup and selected icons", () => {
        const manifest: any = new ManifestV2(Browser.Chrome)
            .setName("Popup Addon")
            .setIcons(new Map([["popup", new Map([[16, "popup16.png"]])]]))
            .setPopup({path: "popup.html", title: "Popup", icon: "popup"})
            .build();

        expect(manifest.browser_action).toEqual({
            default_title: "Popup",
            default_popup: "popup.html",
            default_icon: {16: "popup16.png"},
        });
    });

    it("builds browser_action for execute action commands", () => {
        const manifest: any = new ManifestV2(Browser.Chrome)
            .setName("Command Addon")
            .setCommands(new Set([{name: CommandExecuteActionName}]))
            .build();

        expect(manifest.browser_action).toEqual({default_title: "Command Addon"});
    });

    it("builds sidebar_action only for MV2 browsers that support it", () => {
        const opera: any = new ManifestV2(Browser.Opera).setSidebar({path: "sidebar.html", title: "Sidebar"}).build();
        const chrome: any = new ManifestV2(Browser.Chrome).setSidebar({path: "sidebar.html", title: "Sidebar"}).build();

        expect(opera.sidebar_action.default_panel).toBe("sidebar.html");
        expect(opera.sidebar_action.default_title).toBe("Sidebar");
        expect(chrome.sidebar_action).toBeUndefined();
    });

    it("strips MV3-only content script options", () => {
        const manifest: any = new ManifestV2(Browser.Chrome)
            .setDependencies(new Map([["content", dependency(["content.js"], ["content.css"])]]))
            .setContentScripts(
                new Set([
                    {
                        entry: "content",
                        matches: ["https://example.com/*"],
                        world: "MAIN" as any,
                        matchOriginAsFallback: true,
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
            match_about_blank: undefined,
        });
    });

    it("merges permissions and host permissions into permissions", () => {
        const manifest: any = new ManifestV2(Browser.Chrome)
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

        expect(manifest.host_permissions).toBeUndefined();
        expect(manifest.permissions).toEqual(
            expect.arrayContaining([
                "storage",
                "tabs",
                "bookmarks",
                "https://set.example.com/*",
                "https://append.example.com/*",
                "https://add.example.com/*",
                "https://raw.example.com/*",
            ])
        );
    });

    it("merges optional permissions and optional host permissions into optional_permissions", () => {
        const manifest: any = new ManifestV2(Browser.Chrome)
            .setPermissions(new Set(["storage"]))
            .setHostPermissions(new Set(["https://required.example.com/*"]))
            .setOptionalPermissions(new Set(["bookmarks"]))
            .appendOptionalPermissions(new Set(["history", "storage"]))
            .addOptionalPermission("downloads")
            .setOptionalHostPermissions(new Set(["https://optional.example.com/*"]))
            .appendOptionalHostPermissions(new Set(["https://required.example.com/*"]))
            .addOptionalHostPermission("https://add-optional.example.com/*")
            .raw({optional_permissions: ["sessions"]})
            .build();

        expect(manifest.optional_host_permissions).toBeUndefined();
        expect(manifest.optional_permissions).toEqual(
            expect.arrayContaining([
                "bookmarks",
                "history",
                "downloads",
                "sessions",
                "https://optional.example.com/*",
                "https://add-optional.example.com/*",
            ])
        );
        expect(manifest.optional_permissions).not.toEqual(expect.arrayContaining(["storage"]));
        expect(manifest.optional_permissions).not.toEqual(expect.arrayContaining(["https://required.example.com/*"]));
    });

    it("flattens web accessible resources", () => {
        const manifest: any = new ManifestV2(Browser.Chrome)
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

        expect(manifest.web_accessible_resources).toEqual(
            expect.arrayContaining([
                "img/a.png",
                "img/b.png",
                "img/c.png",
                "img/common.png",
                "img/raw.png",
                "img/onlyraw.png",
            ])
        );
        expect(unique(manifest.web_accessible_resources)).toBe(true);
    });

    it("builds sandbox pages and sandbox content security policy inside the sandbox object", () => {
        const manifest: any = new ManifestV2(Browser.Chrome)
            .raw({
                sandbox: {
                    pages: ["sandbox/raw.html"],
                    content_security_policy: "sandbox allow-scripts; script-src 'self';",
                },
            } as any)
            .addSandbox("sandbox/parser.html")
            .appendSandboxes(["sandbox/extra.html", "sandbox/parser.html"])
            .appendSandboxCsp([{eval: true, sources: {}}])
            .build();

        expect(manifest.sandbox.pages).toEqual(["sandbox/raw.html", "sandbox/parser.html", "sandbox/extra.html"]);
        expect(manifest.sandbox.content_security_policy).toBe(
            "sandbox allow-scripts; script-src 'self' 'unsafe-eval'; child-src 'self';"
        );
    });

    it("does not emit sandbox manifest fields for Firefox", () => {
        const manifest: any = new ManifestV2(Browser.Firefox)
            .raw({
                sandbox: {
                    pages: ["sandbox/raw.html"],
                    content_security_policy: "sandbox allow-scripts; script-src 'self';",
                },
            } as any)
            .addSandbox("sandbox/parser.html")
            .addSandboxCsp({eval: true, sources: {}})
            .build();

        expect(manifest.sandbox).toBeUndefined();
    });

    it("builds MV2 content security policy as a manifest string", () => {
        const manifest: any = new ManifestV2(Browser.Chrome)
            .appendCsp([{sources: {connect: ["https://api.example.com"]}}])
            .build();

        expect(manifest.content_security_policy).toBe(
            "script-src 'self'; object-src 'self'; connect-src https://api.example.com;"
        );
    });

    it("rejects raw content_security_policy when generated CSP is added", () => {
        const builder = new ManifestV2(Browser.Chrome)
            .raw({content_security_policy: "script-src 'self';"} as any)
            .addCsp({sources: {connect: ["https://api.example.com"]}});

        expect(() => builder.build()).toThrow(
            "Cannot merge extension pages content security policy with a raw content_security_policy."
        );
    });
});
