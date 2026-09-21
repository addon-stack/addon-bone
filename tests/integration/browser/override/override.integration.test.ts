import {readFile} from "fs/promises";
import path from "path";

import {waitFor} from "../utils/browser";
import {startBrowserSession} from "../utils/session";
import {createIntegrationFixture, type IntegrationFixture} from "../../utils/fixture";

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");

jest.setTimeout(90_000);

const newtab = "ui/dashboard.newtab.html";

test.each([
    // The New Tab application also ships a Help page, so both views must load the shared View chunk.
    {page: "newtab", adapter: "react", html: newtab, title: "React New Tab", shared: [newtab, "ui/help.html"]},
    {page: "bookmarks", adapter: "vanilla", html: "bookmarks.html", title: "Vanilla Bookmarks", shared: []},
    {page: "history", adapter: "vanilla", html: "history.html", title: "Vanilla History", shared: []},
])("Chrome MV3 replaces chrome://$page with the $adapter entrypoint", async ({page, adapter, html, title, shared}) => {
    let fixture: IntegrationFixture | undefined;
    let session: Awaited<ReturnType<typeof startBrowserSession>> | undefined;

    try {
        fixture = await createIntegrationFixture(rootDir, path.join(__dirname, page));

        const extensionDir = await fixture.build();
        const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));

        expect(manifest.manifest_version).toBe(3);
        expect(manifest.chrome_url_overrides).toEqual({[page]: html});

        for (const view of shared) {
            expect(await readFile(path.join(extensionDir, view), "utf8")).toContain("common.view.js");
        }

        session = await startBrowserSession("chrome", rootDir, extensionDir);

        const {evaluate} = session;

        await session.navigate(`chrome://${page}/`);

        const rendered = await waitFor(
            async () => {
                return (
                    (await evaluate(`(() => {
                        const root = document.querySelector('[data-testid="override"]');

                        if (!root) {
                            return null;
                        }

                        return {
                            adapter: root.dataset.adapter,
                            title: document.title,
                            count: root.querySelector('[data-testid="count"]')?.textContent,
                            color: getComputedStyle(root).color,
                            extensionPage: location.href === chrome.runtime.getURL(${JSON.stringify(html)}),
                        };
                    })()`)) ?? undefined
                );
            },
            15_000,
            `chrome://${page} to render the extension page`
        );

        expect(rendered).toEqual({adapter, title, count: "0", color: "rgb(31, 78, 121)", extensionPage: true});

        await evaluate("document.querySelector('[data-testid=increment]').click()");

        const count = await waitFor(async () => {
            const value = await evaluate("document.querySelector('[data-testid=count]').textContent");

            return value === "1" ? value : undefined;
        });

        expect(count).toBe("1");
        expect(session.errors).toEqual([]);
    } finally {
        await session?.close();
        await fixture?.dispose();
    }
});
