/** @jest-environment node */

import {mkdtemp, rm} from "fs/promises";
import os from "os";
import path from "path";
import {spawn, type ChildProcess} from "child_process";

import {browserVersion, CdpClient, type CdpTarget, findChromeBinary, targets} from "../utils/chrome";
import {getFreePort, stop, waitFor} from "../utils/browser";
import {createIntegrationFixture, type IntegrationFixture} from "../../utils/fixture";

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
const fixtureDir = path.join(__dirname, "service");
const chromeBinary = findChromeBinary(rootDir);

jest.setTimeout(60_000);

test("Chrome MV3 offscreen calls the registered background service", async () => {
    if (!chromeBinary || !path.isAbsolute(chromeBinary)) {
        throw new Error(
            "Chrome is not installed or could not be found. Install Chrome or set ADNBN_CHROME_BIN to its absolute executable path."
        );
    }

    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "adnbn-offscreen-service-"));
    const debuggingPort = await getFreePort();
    let chrome: ChildProcess | undefined;
    let browser: CdpClient | undefined;
    let fixture: IntegrationFixture | undefined;
    let chromeOutput = "";

    try {
        fixture = await createIntegrationFixture(rootDir, fixtureDir);
        const extensionDir = await fixture.build();

        chrome = spawn(
            chromeBinary,
            [
                "--headless=new",
                "--no-sandbox",
                "--no-first-run",
                "--no-default-browser-check",
                "--enable-logging=stderr",
                "--v=0",
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
            throw new Error("Chrome did not return an extension ID after loading the MV3 fixture");
        }

        let chromeTargets: CdpTarget[] = [];
        let worker: CdpTarget;

        try {
            worker = await waitFor(async () => {
                chromeTargets = await targets(debuggingPort);

                return chromeTargets.find(
                    target =>
                        target.type === "service_worker" &&
                        target.url === `chrome-extension://${extensionId}/js/background.js`
                );
            });
        } catch (error) {
            throw new Error(
                `${error instanceof Error ? error.message : String(error)}; CDP targets: ${JSON.stringify(
                    chromeTargets.map(target => ({type: target.type, url: target.url}))
                )}; Chrome output: ${chromeOutput}`
            );
        }

        const attachedWorker = await browser.send("Target.attachToTarget", {targetId: worker.id, flatten: true});
        const workerSessionId = attachedWorker.sessionId as string | undefined;

        if (!workerSessionId) {
            throw new Error("Chrome did not return a DevTools session for the MV3 service worker");
        }

        let backgroundState: unknown;

        try {
            await waitFor(async () => {
                const ready = await browser!.send(
                    "Runtime.evaluate",
                    {
                        expression:
                            "({entrypoint: typeof globalThis.__adnbnRunOffscreenRoundTrip, runtime: typeof chrome?.runtime})",
                        returnByValue: true,
                    },
                    workerSessionId
                );

                backgroundState = ready.result.value;

                return (ready.result.value as {entrypoint?: string}).entrypoint === "function" ? ready : undefined;
            });
        } catch (error) {
            throw new Error(
                `${error instanceof Error ? error.message : String(error)}; background state: ${JSON.stringify(backgroundState)}`
            );
        }

        const result = await browser.send(
            "Runtime.evaluate",
            {
                expression: "globalThis.__adnbnRunOffscreenRoundTrip()",
                awaitPromise: true,
                returnByValue: true,
            },
            workerSessionId
        );

        expect(result.exceptionDetails).toBeUndefined();
        expect(result.result.value).toBe("background:ping");
    } finally {
        await browser?.close();

        if (chrome) {
            await stop(chrome);
        }

        await fixture?.dispose();
        await rm(userDataDir, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
});
