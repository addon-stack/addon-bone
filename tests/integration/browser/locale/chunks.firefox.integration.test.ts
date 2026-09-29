import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";
import BidiClient from "../utils/BidiClient";
import {startBrowserSession, type BrowserSession} from "../utils/session";
import {waitFor} from "../utils/browser";
import {startIntegrationSite, type IntegrationSite} from "../utils/site";
import {changeLanguage, expectPanels, localeFixtureDirectory, readPanels} from "./utils";

jest.setTimeout(90_000);

test("Firefox MV3 loads locale in ISOLATED and shares the MAIN catalogue through common content", async () => {
    const fixture = await createIntegrationFixture(ADNBN_TEST_ROOT, localeFixtureDirectory);
    let session: BrowserSession | undefined;
    let client: BidiClient | undefined;
    let site: IntegrationSite | undefined;

    try {
        const directory = await fixture.build({browser: "firefox"});

        session = await startBrowserSession("firefox", ADNBN_TEST_ROOT, directory, {
            createPage: false,
            firefoxEvents: ["log.entryAdded"],
        });

        client = session.firefox!;
        site = await startIntegrationSite(path.join(fixture.directory, "site"));
        const {context} = await client.send("browsingContext.create", {type: "tab"});
        await client.send("browsingContext.navigate", {context, url: site.origin, wait: "complete"});
        const contexts = ["isolated", "isolated-secondary", "main", "main-secondary"];

        await waitFor(async () => {
            expectPanels(await client!.evaluate(context, readPanels), contexts);

            return true;
        });

        expect(await client.evaluate(context, "typeof globalThis.browser?.i18n")).toBe("undefined");
        await client.evaluate(context, changeLanguage);
        expectPanels(await client.evaluate(context, readPanels), contexts, "fr");
        expect(client.runtimeErrors).toEqual([]);
    } finally {
        await session?.close();
        await site?.close();
        await fixture.dispose();
    }
});
