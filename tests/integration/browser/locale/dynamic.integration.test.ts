import {readFile} from "fs/promises";
import path from "path";
import {createIntegrationFixture} from "../../utils/fixture";
import {startBrowserSession, type BrowserSession} from "../utils/session";
import CdpClient from "../utils/CdpClient";
import {waitFor} from "../utils/browser";
import {startIntegrationSite, type IntegrationSite} from "../utils/site";

jest.setTimeout(90_000);

test("Chrome switches DynamicLocale in both worlds and synchronizes extension storage without loading translations", async () => {
    const fixture = await createIntegrationFixture(
        ADNBN_TEST_ROOT,
        path.join(ADNBN_TEST_ROOT, "tests/integration/build/locale/dynamic-fixture")
    );

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
            await client!.send("Network.enable", {}, sessionId);

            return sessionId;
        };

        const evaluate = async (session: string, expression: string): Promise<any> => {
            const result = await client!.send(
                "Runtime.evaluate",
                {expression, returnByValue: true, awaitPromise: true},
                session
            );

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
            () => evaluate(background, 'globalThis.dynamicLocale?.trans("greeting")'),
            15_000,
            "DynamicLocale initialization in the extension service worker"
        );

        expect(greeting).toBe("Hello from DynamicLocale!");
        site = await startIntegrationSite(path.join(fixture.directory, "site"));
        const sessions: string[] = [];

        const urls = [
            site.origin,
            `${origin}/${manifest.action.default_popup}`,
            `${origin}/${manifest.options_ui.page}`,
        ];

        const expectLanguage = async (session: string, lang: string): Promise<void> => {
            await waitFor(async () => {
                const panel = await evaluate(
                    session,
                    `(() => { const panel = document.querySelector('[data-locale-context]:not([data-locale-context="main"])'); return panel && {lang: panel.dataset.language, message: panel.querySelector('p').textContent}; })()`
                );

                expect(panel).toEqual({
                    lang,
                    message: lang === "fr" ? "Bonjour depuis DynamicLocale !" : "Hello from DynamicLocale!",
                });

                return true;
            });
        };

        for (const url of urls) {
            const {targetId} = await client.send("Target.createTarget", {url: "about:blank"});
            const session = await attach(targetId);
            sessions.push(session);
            await client.send("Page.navigate", {url}, session);
            await expectLanguage(session, "en");
        }

        await waitFor(async () => {
            expect(
                await evaluate(sessions[0], `document.querySelector('[data-locale-context="main"]')?.dataset.language`)
            ).toBe("en");

            return true;
        });

        const before = client.requests.length;

        expect(
            await evaluate(
                sessions[0],
                `(() => {
            const panel = document.querySelector('[data-locale-context="main"]');
            const select = panel.querySelector('select');
            select.value = 'fr';
            select.dispatchEvent(new Event('change', {bubbles: true}));
            return {lang: panel.dataset.language, message: panel.querySelector('p').textContent};
        })()`
            )
        ).toEqual({lang: "fr", message: "Bonjour depuis DynamicLocale !"});

        expect(
            await evaluate(
                background,
                `(async () => (await chrome.storage.local.get('adnbn:locale'))['adnbn:locale'])()`
            )
        ).toBeUndefined();

        const state = await evaluate(
            background,
            `(async () => {
            const saved = dynamicLocale.change('fr');
            const immediate = {
                language: dynamicLocale.lang(),
                greeting: dynamicLocale.trans('greeting'),
                empty: dynamicLocale.trans('empty'),
                fallback: dynamicLocale.trans('fallback'),
                welcome: dynamicLocale.trans('welcome', {name: 'Ada'}),
                plural: dynamicLocale.choice('items', 0, {count: 0}),
            };
            await saved;
            return {immediate, stored: (await chrome.storage.local.get('adnbn:locale'))['adnbn:locale']};
        })()`
        );

        expect(state).toEqual({
            immediate: {
                language: "fr",
                greeting: "Bonjour depuis DynamicLocale !",
                empty: "",
                fallback: "Completed from English",
                welcome: "Bienvenue Ada",
                plural: "0 article",
            },
            stored: "fr",
        });

        for (const session of sessions) {
            await expectLanguage(session, "fr");
        }

        expect(client.requests.slice(before).filter(url => url.startsWith(origin))).toEqual([]);
        await client.send("Page.navigate", {url: urls[1]}, sessions[1]);
        await expectLanguage(sessions[1], "fr");
        const afterReload = client.requests.length;

        expect(
            await evaluate(
                sessions[1],
                `(() => {
            const panel = document.querySelector('[data-locale-context]');
            const select = panel.querySelector('select');
            select.value = 'en';
            select.dispatchEvent(new Event('change', {bubbles: true}));
            return panel.querySelector('p').textContent;
        })()`
            )
        ).toBe("Hello from DynamicLocale!");

        for (const session of sessions) {
            await expectLanguage(session, "en");
        }

        expect(
            await evaluate(sessions[0], `document.querySelector('[data-locale-context="main"]').dataset.language`)
        ).toBe("fr");

        expect(await evaluate(background, "dynamicLocale.sync()")).toBe("en");
        expect(client.requests.slice(afterReload).filter(url => url.startsWith(origin))).toEqual([]);
        expect(client.requests.filter(url => /_locales\/|messages\.json/.test(url))).toEqual([]);
        expect(client.runtimeErrors).toEqual([]);
    } finally {
        await session?.close();

        await site?.close();
        await fixture.dispose();
    }
});
