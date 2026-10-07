import {readFile} from "fs/promises";
import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
const fixtureDir = path.join(__dirname, "views");

jest.setTimeout(90_000);

const host = "https://*.example.com/*";
const pageHost = "https://api.example.net/*";
const firefoxHost = "https://firefox.example.net/*";
const optionalHost = "https://export.example.org/*";
const optionalFirefoxHost = "https://optional-firefox.example.org/*";
const offscreenHost = "https://offscreen.example.net/*";
const optionalOffscreenHost = "https://optional-offscreen.example.org/*";
const firefoxOffscreenHost = "https://firefox-offscreen.example.net/*";
const optionalFirefoxOffscreenHost = "https://optional-firefox-offscreen.example.org/*";

/**
 * The application builds two popups and two sidebars (one of each is not applied by default)
 * an options page, two pages and two offscreens. One page and one offscreen are Firefox-only.
 * Pages and offscreens are never opened; their inclusion in the build is enough to contribute permissions and CSP.
 */
test.each([
    {
        target: "chrome MV3 collects every built view and the side panel permission",
        browser: "chrome",
        manifestVersion: 3,
        permissions: [
            "alarms",
            "bookmarks",
            "downloads",
            "history",
            "offscreen",
            "sidePanel",
            "storage",
            "tabs",
            "geolocation",
        ],
        optionalPermissions: ["clipboardWrite", "topSites", "contextMenus"],
        hostPermissions: [host, pageHost, offscreenHost],
        optionalHostPermissions: [optionalHost, optionalOffscreenHost],
    },
    {
        target: "chrome MV2 has no sidebar, so sidebar permissions are not requested",
        browser: "chrome",
        manifestVersion: 2,
        permissions: ["alarms", "downloads", host, pageHost, offscreenHost, "storage", "tabs", "geolocation"],
        optionalPermissions: ["clipboardWrite", "topSites", "contextMenus", optionalHost, optionalOffscreenHost],
        hostPermissions: undefined,
        optionalHostPermissions: undefined,
    },
    {
        target: "firefox MV3 builds the sidebar action without the side panel permission",
        browser: "firefox",
        manifestVersion: 3,
        permissions: [
            "alarms",
            "bookmarks",
            "downloads",
            "history",
            "notifications",
            "storage",
            "tabs",
            "geolocation",
            "webRequest",
        ],
        optionalPermissions: ["clipboardWrite", "sessions", "idle", "topSites", "contextMenus"],
        hostPermissions: [host, pageHost, firefoxHost, offscreenHost, firefoxOffscreenHost],
        optionalHostPermissions: [
            optionalHost,
            optionalFirefoxHost,
            optionalOffscreenHost,
            optionalFirefoxOffscreenHost,
        ],
    },
    {
        target: "firefox MV2 keeps sidebar permissions and declares hosts as permissions",
        browser: "firefox",
        manifestVersion: 2,
        permissions: [
            "alarms",
            "bookmarks",
            "downloads",
            "history",
            host,
            pageHost,
            firefoxHost,
            offscreenHost,
            firefoxOffscreenHost,
            "notifications",
            "storage",
            "tabs",
            "geolocation",
            "webRequest",
        ],
        optionalPermissions: [
            "clipboardWrite",
            "sessions",
            "idle",
            "topSites",
            "contextMenus",
            optionalHost,
            optionalFirefoxHost,
            optionalOffscreenHost,
            optionalFirefoxOffscreenHost,
        ],
        hostPermissions: undefined,
        optionalHostPermissions: undefined,
    },
] as const)(
    "$target",
    async ({browser, manifestVersion, permissions, optionalPermissions, hostPermissions, optionalHostPermissions}) => {
        const fixture = await createIntegrationFixture(rootDir, fixtureDir);

        try {
            const extensionDir = await fixture.build({browser, manifestVersion});
            const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));

            expect(manifest.manifest_version).toBe(manifestVersion);
            expect([...manifest.permissions].sort()).toEqual([...permissions].sort());
            expect([...manifest.optional_permissions].sort()).toEqual([...optionalPermissions].sort());
            expect(manifest.host_permissions?.sort()).toEqual(hostPermissions && [...hostPermissions].sort());
            expect(manifest.optional_host_permissions?.sort()).toEqual(
                optionalHostPermissions && [...optionalHostPermissions].sort()
            );

            const csp =
                manifestVersion === 2
                    ? manifest.content_security_policy
                    : manifest.content_security_policy.extension_pages;

            const sources =
                browser === "firefox"
                    ? [
                          "https://api.example.net",
                          "https://firefox.example.net",
                          "https://offscreen.example.net",
                          "https://firefox-offscreen.example.net",
                      ]
                    : ["https://api.example.net", "https://offscreen.example.net"];

            const connect = csp
                .split(";")
                .map((directive: string) => directive.trim().split(/\s+/))
                .find((parts: string[]) => parts[0] === "connect-src");

            expect(connect?.slice(1).sort()).toEqual(sources.sort());
            expect(await readFile(path.join(extensionDir, "reports.html"), "utf8")).toContain("Reports");

            if (manifestVersion === 2) {
                expect(manifest.web_accessible_resources).toEqual(["reports.html"]);
            } else {
                expect(manifest.web_accessible_resources).toEqual([
                    {resources: ["reports.html"], matches: ["https://site.example.org/*"]},
                ]);
            }
        } finally {
            await fixture.dispose();
        }
    }
);
