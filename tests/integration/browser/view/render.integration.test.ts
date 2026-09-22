import {mkdtemp, readFile, rm} from "fs/promises";
import os from "os";
import path from "path";
import {spawn, type ChildProcess} from "child_process";

import {browserVersion, findChromeBinary} from "../utils/chrome";
import CdpClient from "../utils/CdpClient";
import {getFreePort, stop, waitFor} from "../utils/browser";
import {startIntegrationSite, type IntegrationSite} from "../utils/site";
import {createIntegrationFixture, type IntegrationFixture} from "../../utils/fixture";

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
const chromeBinary = findChromeBinary(rootDir);

jest.setTimeout(90_000);

test("Chrome MV3 renders offscreen, sandbox, page and content views through the injected builders", async () => {
    if (!chromeBinary || !path.isAbsolute(chromeBinary)) {
        throw new Error(
            "Chrome is not installed or could not be found. Install Chrome or set ADNBN_CHROME_BIN to its absolute executable path."
        );
    }

    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "adnbn-view-render-"));
    const debuggingPort = await getFreePort();
    let chrome: ChildProcess | undefined;
    let browser: CdpClient | undefined;
    let fixture: IntegrationFixture | undefined;
    let site: IntegrationSite | undefined;
    let chromeOutput = "";

    try {
        fixture = await createIntegrationFixture(rootDir, path.join(__dirname, "render"));
        site = await startIntegrationSite(path.join(fixture.directory, "site"), null);

        const extensionDir = await fixture.build();
        const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));

        expect(manifest.manifest_version).toBe(3);
        expect(manifest.permissions).toEqual(["offscreen"]);

        chrome = spawn(
            chromeBinary,
            [
                "--headless=new",
                "--no-sandbox",
                "--no-first-run",
                "--no-default-browser-check",
                `--remote-debugging-port=${debuggingPort}`,
                `--user-data-dir=${userDataDir}`,
                "about:blank",
            ],
            {stdio: ["ignore", "ignore", "pipe"]}
        );
        chrome.stderr?.on("data", chunk => (chromeOutput += chunk));

        const {webSocketDebuggerUrl} = await waitFor(() => browserVersion(debuggingPort));
        browser = await CdpClient.connect(webSocketDebuggerUrl);

        const extension = await browser.send("Extensions.loadUnpacked", {path: extensionDir});
        const extensionId = extension.id as string | undefined;

        if (!extensionId) {
            throw new Error("Chrome did not return an extension ID after loading the view fixture");
        }

        const open = async (url: string) => {
            const {targetId} = await browser!.send("Target.createTarget", {url});
            const {sessionId} = await browser!.send("Target.attachToTarget", {targetId, flatten: true});

            await browser!.send("Runtime.enable", {}, sessionId);

            return async (expression: string): Promise<any> => {
                const result = await browser!.send(
                    "Runtime.evaluate",
                    {expression, awaitPromise: true, returnByValue: true},
                    sessionId
                );

                if (result.exceptionDetails) {
                    throw new Error(JSON.stringify(result.exceptionDetails));
                }

                return result.result.value;
            };
        };

        // A string render is text in every adapter: no <b> element may appear.
        const readText = (evaluate: (expression: string) => Promise<any>) => {
            return waitFor(() =>
                evaluate(`(() => {
                    const text = document.body.firstElementChild?.textContent;

                    return text ? {title: document.title, text, markup: document.querySelector("b") !== null} : undefined;
                })()`)
            );
        };

        const popup = await open(`chrome-extension://${extensionId}/popup.html`);
        const result = JSON.parse(
            await waitFor(() => popup("document.getElementById('result')?.value || undefined"), 30_000, "view calls")
        );

        expect(result).toEqual({
            offscreen: {title: "Worker", text: "React offscreen: Worker"},
            headless: {containers: 0},
            sandbox: {title: "Frame", text: "React sandbox: Frame"},
        });

        await expect(readText(await open(`chrome-extension://${extensionId}/text.html`))).resolves.toEqual({
            title: "React text",
            text: "<b>React text</b>",
            markup: false,
        });

        await expect(readText(await open(`chrome-extension://${extensionId}/markup.html`))).resolves.toEqual({
            title: "Vanilla text",
            text: "<b>Vanilla text</b>",
            markup: false,
        });

        const page = await open(`${site.origin}/top.html`);
        const note = await waitFor(() =>
            page(`(() => {
                const note = [...document.body.children].find(element => element.textContent.includes("React content text"));

                return note ? {text: note.textContent, markup: document.querySelector("b") !== null} : undefined;
            })()`)
        );

        expect(note).toEqual({text: "<b>React content text</b>", markup: false});
        expect(browser.runtimeErrors).toEqual([]);
    } catch (error) {
        throw new Error(`${String(error)}; Chrome output: ${chromeOutput}`, {cause: error});
    } finally {
        await browser?.close();

        if (chrome) {
            await stop(chrome);
        }

        await site?.close();
        await fixture?.dispose();
        await rm(userDataDir, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
});
