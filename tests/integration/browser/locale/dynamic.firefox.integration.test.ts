import path from "path";
import {createIntegrationFixture} from "../../utils/fixture";
import BidiClient from "../utils/BidiClient";
import {startBrowserSession, type BrowserSession} from "../utils/session";
import {waitFor} from "../utils/browser";
import {startIntegrationSite, type IntegrationSite} from "../utils/site";

jest.setTimeout(90_000);

test("Firefox uses DynamicLocale in both worlds and restores stored selection only in ISOLATED without requests", async () => {
    const fixture = await createIntegrationFixture(
        ADNBN_TEST_ROOT,
        path.join(ADNBN_TEST_ROOT, "tests/integration/build/locale/dynamic-fixture")
    );

    let session: BrowserSession | undefined;
    let client: BidiClient | undefined;
    let site: IntegrationSite | undefined;

    try {
        const directory = await fixture.build({browser: "firefox"});

        session = await startBrowserSession("firefox", ADNBN_TEST_ROOT, directory, {
            createPage: false,
            firefoxEvents: ["log.entryAdded", "network.beforeRequestSent"],
        });

        client = session.firefox!;
        site = await startIntegrationSite(path.join(fixture.directory, "site"));

        const expectLanguage = async (context: string, language: string) =>
            waitFor(async () => {
                expect(
                    await client!.evaluate(
                        context,
                        `document.querySelector('[data-locale-context="isolated"]')?.dataset.language`
                    )
                ).toBe(language);

                return true;
            });

        const {context} = await client.send("browsingContext.create", {type: "tab"});
        await client.send("browsingContext.navigate", {context, url: site.origin, wait: "complete"});
        await expectLanguage(context, "en");

        await waitFor(async () => {
            expect(
                await client!.evaluate(
                    context,
                    `document.querySelector('[data-locale-context="main"]')?.dataset.language`
                )
            ).toBe("en");

            return true;
        });

        const before = client.requests.length;

        const greeting = await client.evaluate(
            context,
            `(() => {
            const panel = document.querySelector('[data-locale-context="isolated"]');
            const select = panel.querySelector('select');
            select.value = 'fr';
            select.dispatchEvent(new Event('change', {bubbles: true}));
            return panel.querySelector('p').textContent;
        })()`
        );

        expect(greeting).toBe("Bonjour depuis DynamicLocale !");
        const second = await client.send("browsingContext.create", {type: "tab"});
        await client.send("browsingContext.navigate", {context: second.context, url: site.origin, wait: "complete"});
        await expectLanguage(second.context, "fr");

        await waitFor(async () => {
            expect(
                await client!.evaluate(
                    second.context,
                    `document.querySelector('[data-locale-context="main"]')?.dataset.language`
                )
            ).toBe("en");

            return true;
        });

        expect(
            await client.evaluate(
                context,
                `(() => {
            const panel = document.querySelector('[data-locale-context="main"]');
            const select = panel.querySelector('select');
            select.value = 'fr';
            select.dispatchEvent(new Event('change', {bubbles: true}));
            return {lang: panel.dataset.language, message: panel.querySelector('p').textContent};
        })()`
            )
        ).toEqual({lang: "fr", message: "Bonjour depuis DynamicLocale !"});

        await client.evaluate(
            second.context,
            `(() => {
            const select = document.querySelector('[data-locale-context="isolated"] select');
            select.value = 'en';
            select.dispatchEvent(new Event('change', {bubbles: true}));
        })()`
        );

        await expectLanguage(context, "en");

        expect(
            await client.evaluate(context, `document.querySelector('[data-locale-context="main"]').dataset.language`)
        ).toBe("fr");

        expect(client.requests.slice(before).filter(url => url.startsWith("moz-extension://"))).toEqual([]);
        expect(client.requests.filter(url => /_locales\/|messages\.json/.test(url))).toEqual([]);
        expect(client.runtimeErrors).toEqual([]);
    } finally {
        await session?.close();
        await site?.close();
        await fixture.dispose();
    }
});
