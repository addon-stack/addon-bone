import path from "node:path";
import {createIntegrationFixture} from "@tests/integration/utils/fixture";
import {startBrowserSession} from "@tests/integration/browser/utils/session";
import {startIntegrationSite} from "@tests/integration/browser/utils/site";
import {waitFor} from "@tests/integration/browser/utils/browser";

type BrowserSession = Awaited<ReturnType<typeof startBrowserSession>>;

export async function expectRelayScripting(browser: "chrome" | "firefox", manifestVersion: 2 | 3): Promise<void> {
    const root = path.resolve(__dirname, "../../../..");
    const fixture = await createIntegrationFixture(root, path.join(__dirname, "scripting"));
    const site = await startIntegrationSite(path.join(fixture.directory, "site"), null);
    let session: BrowserSession | undefined;

    try {
        const extension = await fixture.build({browser, manifestVersion});

        session = await startBrowserSession(browser, root, extension);
        await session.navigate(`${site.origin}/top.html`);

        const result = await waitFor(async () => {
            const value = await session!.evaluate("document.body?.dataset.result");

            return value ? JSON.parse(value) : undefined;
        }).catch(error => {
            throw new Error(`${error}; browser errors: ${JSON.stringify(session!.errors)}`);
        });

        expect(result).toEqual({
            empty: true,
            nullable: true,
            thrown: {name: "TypeError", message: "Remote failure"},
            rejected: {name: "RangeError", message: "Async failure"},
            any: [{status: "rejected", kind: "remote", name: "Error", message: "Relay manager not found."}],
            missing: {name: "Error", message: "Relay manager not found after 10 attempts."},
        });
        expect(session.errors).toEqual([]);
    } finally {
        await session?.close();
        await site.close();
        await fixture.dispose();
    }
}
