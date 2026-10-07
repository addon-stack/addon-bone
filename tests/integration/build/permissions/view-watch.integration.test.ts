import {spawn, type ChildProcess} from "child_process";
import {readFile, rm, writeFile} from "fs/promises";
import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";
import {stop, waitFor} from "../../browser/utils/browser";

jest.setTimeout(90_000);

test("CLI watch replaces page and offscreen permissions and a fresh build drops removed views", async () => {
    const root = path.resolve(__dirname, "../../../..");
    const fixture = await createIntegrationFixture(root, path.join(__dirname, "views"));
    let watcher: ChildProcess | undefined;
    let output = "";

    try {
        const directory = await fixture.build({browser: "chrome"});
        const manifestPath = path.join(directory, "manifest.json");
        const entry = path.join(fixture.directory, "src", "reports.page.ts");
        const offscreen = path.join(fixture.directory, "src", "processor.offscreen.ts");
        await rm(manifestPath);

        watcher = spawn(process.execPath, [path.join(root, "bin", "adnbn.js"), "watch", ".", "-b", "chrome"], {
            cwd: fixture.directory,
            stdio: ["ignore", "pipe", "pipe"],
        });

        watcher.stdout?.on("data", chunk => {
            output += chunk;
        });

        watcher.stderr?.on("data", chunk => {
            output += chunk;
        });

        const completedBuilds = () =>
            (output.replace(/\x1b\[[0-9;]*m/g, "").match(/Rspack [^\n]* compiled successfully/g) ?? []).length;

        const observe = (
            state: string,
            after: number,
            permissions: string[],
            optionalPermissions: string[],
            hosts: string[],
            optionalHosts: string[] | undefined
        ) =>
            waitFor(
                async () => {
                    if (completedBuilds() <= after) {
                        return undefined;
                    }

                    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

                    expect([...manifest.permissions].sort()).toEqual([...permissions].sort());
                    expect([...manifest.optional_permissions].sort()).toEqual([...optionalPermissions].sort());
                    expect([...manifest.host_permissions].sort()).toEqual([...hosts].sort());
                    expect(manifest.optional_host_permissions?.sort()).toEqual(
                        optionalHosts && [...optionalHosts].sort()
                    );

                    return manifest;
                },
                15_000,
                `CLI watch view permissions after ${state}`
            );

        const retained = ["bookmarks", "downloads", "history", "sidePanel", "storage", "tabs"];
        const retainedHost = "https://*.example.com/*";

        await observe(
            "startup",
            0,
            [...retained, "alarms", "offscreen", "geolocation"],
            ["clipboardWrite", "topSites", "contextMenus"],
            [retainedHost, "https://api.example.net/*", "https://offscreen.example.net/*"],
            ["https://export.example.org/*", "https://optional-offscreen.example.org/*"]
        );

        const beforeEdit = completedBuilds();
        await writeFile(entry, await readFile(path.join(__dirname, "states", "reports.ts")));

        const changed = await observe(
            "page edit",
            beforeEdit,
            [...retained, "idle", "offscreen", "geolocation"],
            ["clipboardRead", "topSites", "contextMenus"],
            [retainedHost, "https://changed.example.net/*", "https://offscreen.example.net/*"],
            ["https://changed.example.org/*", "https://optional-offscreen.example.org/*"]
        );

        expect(changed.content_security_policy.extension_pages).toContain("https://changed.example.net");
        expect(changed.content_security_policy.extension_pages).toContain("https://offscreen.example.net");
        expect(changed.content_security_policy.extension_pages).not.toContain("https://api.example.net");

        const beforeOffscreenEdit = completedBuilds();
        await writeFile(offscreen, await readFile(path.join(__dirname, "states", "processor.ts")));

        const changedOffscreen = await observe(
            "offscreen edit",
            beforeOffscreenEdit,
            [...retained, "idle", "offscreen", "management"],
            ["clipboardRead", "topSites", "cookies"],
            [retainedHost, "https://changed.example.net/*", "https://changed-offscreen.example.net/*"],
            ["https://changed.example.org/*", "https://optional-changed-offscreen.example.org/*"]
        );

        expect(changedOffscreen.content_security_policy.extension_pages).toContain("https://changed.example.net");

        expect(changedOffscreen.content_security_policy.extension_pages).toContain(
            "https://changed-offscreen.example.net"
        );

        expect(changedOffscreen.content_security_policy.extension_pages).not.toContain("https://offscreen.example.net");

        // Entrypoint deletion is checked after stopping watch, as in the Relay integration.
        await stop(watcher);
        watcher = undefined;
        await rm(entry);
        await rm(offscreen);
        await fixture.build({browser: "chrome"});

        const removed = JSON.parse(await readFile(manifestPath, "utf8"));

        expect([...removed.permissions].sort()).toEqual([...retained].sort());
        expect(removed.optional_permissions).toEqual(["topSites"]);
        expect(removed.host_permissions).toEqual([retainedHost]);
        expect(removed.optional_host_permissions).toBeUndefined();
        expect(removed.content_security_policy).toBeUndefined();
        expect(removed.web_accessible_resources).toBeUndefined();
    } catch (error) {
        throw new Error(`${String(error)}\n${output}`, {cause: error});
    } finally {
        try {
            if (watcher) {
                await stop(watcher);
            }
        } finally {
            await fixture.dispose();
        }
    }
});
