/** @jest-environment node */

import {spawn, type ChildProcess} from "child_process";
import {mkdtemp, readFile, rm} from "fs/promises";
import os from "os";
import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";
import {browserVersion, CdpClient, findChromeBinary} from "../utils/chrome";
import {getFreePort, stop, waitFor} from "../utils/browser";
import {startIntegrationSite, type IntegrationSite} from "../utils/site";
import {ChangeLanguage, expectPanels, LocaleFixtureDirectory, ReadPanels} from "./utils";

jest.setTimeout(90_000);

test("Chrome shares locale with views and ISOLATED, and loads the MAIN catalogue through common content", async () => {
    const binary = findChromeBinary(ADNBN_TEST_ROOT);
    if (!binary) throw new Error("Install Chrome for Testing or set ADNBN_CHROME_BIN");
    const fixture = await createIntegrationFixture(ADNBN_TEST_ROOT, LocaleFixtureDirectory);
    const profile = await mkdtemp(path.join(os.tmpdir(), "adnbn-locale-chrome-"));
    let process: ChildProcess | undefined;
    let client: CdpClient | undefined;
    let site: IntegrationSite | undefined;

    try {
        const directory = await fixture.build();
        const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
        const port = await getFreePort();
        process = spawn(
            binary,
            [
                "--headless=new",
                "--no-sandbox",
                "--no-first-run",
                "--no-default-browser-check",
                `--user-data-dir=${profile}`,
                `--remote-debugging-port=${port}`,
                "about:blank",
            ],
            {stdio: "ignore"}
        );
        const {webSocketDebuggerUrl} = await waitFor(() => browserVersion(port));
        client = await CdpClient.connect(webSocketDebuggerUrl);
        const extension = await client.send("Extensions.loadUnpacked", {path: directory});
        const origin = `chrome-extension://${extension.id}`;

        const attach = async (targetId: string): Promise<string> => {
            const {sessionId} = await client!.send("Target.attachToTarget", {targetId, flatten: true});
            await client!.send("Runtime.enable", {}, sessionId);
            return sessionId;
        };
        const evaluate = async (session: string, expression: string): Promise<any> => {
            const result = await client!.send("Runtime.evaluate", {expression, returnByValue: true}, session);
            if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
            return result.result.value;
        };
        const worker = await waitFor(async () => {
            const {targetInfos} = await client!.send("Target.getTargets");
            return targetInfos.find(
                (target: {url: string}) => target.url === `${origin}/${manifest.background.service_worker}`
            );
        });
        const background = await attach(worker.targetId);
        expect(await evaluate(background, "globalThis.catalogue.en.greeting")).toBe(
            "Hello from the locale chunk fixture"
        );

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
                expectPanels(await evaluate(session, ReadPanels), page.contexts);
                return true;
            });
            if (page.url === site.origin) {
                expect(await evaluate(session, "typeof globalThis.chrome?.i18n")).toBe("undefined");
            }
            await evaluate(session, ChangeLanguage);
            expectPanels(await evaluate(session, ReadPanels), page.contexts, "fr");
        }
        expect(client.runtimeErrors).toEqual([]);
    } finally {
        await client?.close();
        if (process) await stop(process);
        await site?.close();
        await fixture.dispose();
        await rm(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
});
