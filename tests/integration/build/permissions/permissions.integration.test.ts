import {readFile} from "fs/promises";
import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
const fixtureDir = path.join(__dirname, "views");

jest.setTimeout(90_000);

const host = "https://*.example.com/*";

/**
 * The application builds two popups and two sidebars (one of each is not applied by default)
 * and an options page, and every entrypoint declares its own permissions.
 */
test.each([
    {
        target: "chrome MV3 collects every built view and the side panel permission",
        browser: "chrome",
        manifestVersion: 3,
        permissions: ["bookmarks", "downloads", "history", "sidePanel", "storage", "tabs"],
        hostPermissions: [host],
    },
    {
        target: "chrome MV2 has no sidebar, so sidebar permissions are not requested",
        browser: "chrome",
        manifestVersion: 2,
        permissions: ["downloads", host, "storage", "tabs"],
        hostPermissions: undefined,
    },
    {
        target: "firefox MV3 builds the sidebar action without the side panel permission",
        browser: "firefox",
        manifestVersion: 3,
        permissions: ["bookmarks", "downloads", "history", "storage", "tabs"],
        hostPermissions: [host],
    },
    {
        target: "firefox MV2 keeps sidebar permissions and declares hosts as permissions",
        browser: "firefox",
        manifestVersion: 2,
        permissions: ["bookmarks", "downloads", "history", host, "storage", "tabs"],
        hostPermissions: undefined,
    },
] as const)("$target", async ({browser, manifestVersion, permissions, hostPermissions}) => {
    const fixture = await createIntegrationFixture(rootDir, fixtureDir);

    try {
        const extensionDir = await fixture.build({browser, manifestVersion});
        const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));

        expect(manifest.manifest_version).toBe(manifestVersion);
        expect([...manifest.permissions].sort()).toEqual([...permissions].sort());
        expect(manifest.optional_permissions).toEqual(["topSites"]);
        expect(manifest.host_permissions).toEqual(hostPermissions);
    } finally {
        await fixture.dispose();
    }
});
