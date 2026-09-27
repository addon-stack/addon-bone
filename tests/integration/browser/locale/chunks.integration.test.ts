import {readFile} from "fs/promises";
import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";
import {startBrowserSession, type BrowserSession} from "../utils/session";
import CdpClient from "../utils/CdpClient";
import {waitFor} from "../utils/browser";
import {startIntegrationSite, type IntegrationSite} from "../utils/site";
import {changeLanguage, expectPanels, localeFixtureDirectory, readPanels} from "./utils";

jest.setTimeout(90_000);

test("Chrome shares locale with views and ISOLATED, and loads the MAIN catalogue through common content", async () => {
    const fixture = await createIntegrationFixture(ADNBN_TEST_ROOT, localeFixtureDirectory);
    let session: BrowserSession | undefined;
    let client: CdpClient | undefined;
    let site: IntegrationSite | undefined;

    try {
        const directory = await fixture.build();
        const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
        session = await startBrowserSession("chrome", ADNBN_TEST_ROOT, directory, {createPage: false});
        client = session.chrome!;
        const origin = `chrome-extension://${session.extensionId}`;

        const attach = async (targetId: string): Promise<string> => {
            const {sessionId} = await client!.send("Target.attachToTarget", {targetId, flatten: true});
            await client!.send("Runtime.enable", {}, sessionId);

            return sessionId;
        };

        const evaluate = async (session: string, expression: string): Promise<any> => {
            const result = await client!.send("Runtime.evaluate", {expression, returnByValue: true}, session);

            if (result.exceptionDetails) {
                throw new Error(JSON.stringify(result.exceptionDetails));
            }

            return result.result.value;
        };

        const worker = await waitFor(async () => {
            const {targetInfos} = await client!.send("Target.getTargets");

            return targetInfos.find(
                (target: {url: string}) => target.url === `${origin}/${manifest.background.service_worker}`
            );
        });

        const background = await attach(worker.targetId);

        // DevTools can expose the worker before its background module has executed.
        const greeting = await waitFor(
            () => evaluate(background, "globalThis.catalogue?.en?.greeting"),
            15_000,
            "the locale catalogue in the extension service worker"
        );

        expect(greeting).toBe("Hello from the locale chunk fixture");

        site = await startIntegrationSite(path.join(fixture.directory, "site"));

        const pages = [
            {url: site.origin, contexts: ["isolated", "isolated-secondary", "main", "main-secondary"]},
            {url: `${origin}/${manifest.action.default_popup}`, contexts: ["popup"]},
            {url: `${origin}/${manifest.options_ui.page}`, contexts: ["options"]},
        ];

        for (const page of pages) {
            const {targetId} = await client.send("Target.createTarget", {url: "about:blank"});
            const session = await attach(targetId);
            await client.send("Page.navigate", {url: page.url}, session);

            await waitFor(async () => {
                expectPanels(await evaluate(session, readPanels), page.contexts);

                return true;
            });

            if (page.url === site.origin) {
                expect(await evaluate(session, "typeof globalThis.chrome?.i18n")).toBe("undefined");
            }

            await evaluate(session, changeLanguage);
            expectPanels(await evaluate(session, readPanels), page.contexts, "fr");
        }

        expect(client.runtimeErrors).toEqual([]);
    } finally {
        await session?.close();

        await site?.close();
        await fixture.dispose();
    }
});
