/** @jest-environment node */
import path from "path";
import {readFile} from "fs/promises";
import {createIntegrationFixture} from "../../utils/fixture";
import {startBrowserSession} from "../utils/session";
import {startIntegrationSite} from "../utils/site";
import {waitFor} from "../utils/browser";

jest.setTimeout(90_000);
test.each([
    ["chrome", 3],
    ["firefox", 2],
    ["firefox", 3],
] as const)("%s MV%s routes Relay CSS and calls its UI through real RPC", async (browser, manifestVersion) => {
    const root = path.resolve(__dirname, "../../../..");
    const fixture = await createIntegrationFixture(root, path.join(__dirname, "relay-styles"));
    const site = await startIntegrationSite(path.join(fixture.directory, "site"), null);
    let session: Awaited<ReturnType<typeof startBrowserSession>> | undefined;
    try {
        const extension = await fixture.build({browser, manifestVersion});
        const manifest = JSON.parse(await readFile(path.join(extension, "manifest.json"), "utf8"));
        expect(manifest.content_scripts).toHaveLength(3);
        session = await startBrowserSession(browser, root, extension);
        await session.navigate(site.origin + "/top.html");
        const result = await waitFor(async () => {
            const value = await session!.evaluate("document.querySelector('.control-host')?.dataset.result");
            return value ? JSON.parse(value) : undefined;
        }).catch(async error => {
            throw new Error(
                `${String(error)}; state: ${JSON.stringify(await session!.evaluate("({html: document.body.innerHTML, url: location.href})"))}; errors: ${JSON.stringify(session!.errors)}`
            );
        });
        expect(result).toEqual({
            shadow: {
                color: "rgb(17, 85, 153)",
                background: "rgb(34, 102, 68)",
                host: "3px",
                isolated: true,
                mode: "closed",
                closed: true,
                isolation: {type: "shadow", mode: "closed"},
            },
            iframe: {
                color: "rgb(17, 85, 153)",
                background: "rgb(34, 102, 68)",
                host: "3px",
                isolated: true,
                isolation: {type: "iframe", width: "100%", height: 150},
            },
            page: "rgb(17, 85, 153)",
        });
        expect(session.errors).toEqual([]);
    } finally {
        await session?.close();
        await site.close();
        await fixture.dispose();
    }
});
