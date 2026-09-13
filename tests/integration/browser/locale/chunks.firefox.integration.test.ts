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
import {ChangeLanguage, expectPanels, LocaleFixtureDirectory, ReadPanels} from "./utils";

jest.setTimeout(90_000);

test("Firefox MV3 loads locale in ISOLATED and shares the MAIN catalogue through common content", async () => {
    const binary = findFirefoxBinary();
    if (!binary) throw new Error("Install Firefox or set ADNBN_FIREFOX_BIN");
    const fixture = await createIntegrationFixture(ADNBN_TEST_ROOT, LocaleFixtureDirectory);
    const profile = await mkdtemp(path.join(os.tmpdir(), "adnbn-locale-firefox-"));
    let process: ChildProcess | undefined;
    let client: BidiClient | undefined;
    let site: IntegrationSite | undefined;

    try {
        const directory = await fixture.build({browser: "firefox"});
        const port = await getFreePort();
        process = spawn(
            binary,
            ["--headless", "--no-remote", "--profile", profile, "--remote-debugging-port", String(port), "about:blank"],
            {stdio: "ignore"}
        );
        client = await waitFor(() => BidiClient.connect(`ws://127.0.0.1:${port}/session`));
        await client.send("session.new", {capabilities: {alwaysMatch: {}}});
        await client.send("session.subscribe", {events: ["log.entryAdded"]});
        await client.send("webExtension.install", {extensionData: {path: directory, type: "path"}});
        site = await startIntegrationSite(path.join(fixture.directory, "site"));
        const {context} = await client.send("browsingContext.create", {type: "tab"});
        await client.send("browsingContext.navigate", {context, url: site.origin, wait: "complete"});
        const contexts = ["isolated", "isolated-secondary", "main", "main-secondary"];
        await waitFor(async () => {
            expectPanels(await client!.evaluate(context, ReadPanels), contexts);
            return true;
        });
        expect(await client.evaluate(context, "typeof globalThis.browser?.i18n")).toBe("undefined");
        await client.evaluate(context, ChangeLanguage);
        expectPanels(await client.evaluate(context, ReadPanels), contexts, "fr");
        expect(client.runtimeErrors).toEqual([]);
    } finally {
        await client?.close();
        if (process) await stop(process);
        await site?.close();
        await fixture.dispose();
        await rm(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
});
