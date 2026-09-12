/** @jest-environment node */

import {spawn, type ChildProcess} from "child_process";
import {mkdtemp, rm} from "fs/promises";
import os from "os";
import path from "path";
import {createIntegrationFixture} from "../../utils/fixture";
import BidiClient from "../utils/BidiClient";
import {findFirefoxBinary} from "../utils/firefox";
import {getFreePort, stop, waitFor} from "../utils/browser";
import {startIntegrationSite, type IntegrationSite} from "../utils/site";

jest.setTimeout(90_000);

test("Firefox uses DynamicLocale in both worlds and restores stored selection only in ISOLATED without requests", async () => {
    const binary = findFirefoxBinary();
    if (!binary) throw new Error("Install Firefox or set ADNBN_FIREFOX_BIN");
    const fixture = await createIntegrationFixture(
        ADNBN_TEST_ROOT,
        path.join(ADNBN_TEST_ROOT, "tests/integration/build/locale/dynamic-fixture")
    );
    const profile = await mkdtemp(path.join(os.tmpdir(), "adnbn-dynamic-locale-firefox-"));
    let browser: ChildProcess | undefined;
    let client: BidiClient | undefined;
    let site: IntegrationSite | undefined;
    try {
        const directory = await fixture.build({browser: "firefox"});
        const port = await getFreePort();
        browser = spawn(
            binary,
            ["--headless", "--no-remote", "--profile", profile, "--remote-debugging-port", String(port), "about:blank"],
            {stdio: "ignore"}
        );
        client = await waitFor(() => BidiClient.connect(`ws://127.0.0.1:${port}/session`));
        await client.send("session.new", {capabilities: {alwaysMatch: {}}});
        await client.send("session.subscribe", {events: ["log.entryAdded", "network.beforeRequestSent"]});
        await client.send("webExtension.install", {extensionData: {path: directory, type: "path"}});
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
        await client?.close();
        if (browser) await stop(browser);
        await site?.close();
        await fixture.dispose();
        await rm(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
});
