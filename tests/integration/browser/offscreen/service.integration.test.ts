import path from "path";

import {type CdpTarget, targets} from "../utils/chrome";
import {startBrowserSession, type BrowserSession} from "../utils/session";
import CdpClient from "../utils/CdpClient";
import {waitFor} from "../utils/browser";
import {createIntegrationFixture, type IntegrationFixture} from "../../utils/fixture";

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
const fixtureDir = path.join(__dirname, "service");

jest.setTimeout(60_000);

test("Chrome MV3 offscreen calls the registered background service", async () => {
    let session: BrowserSession | undefined;
    let browser: CdpClient | undefined;
    let fixture: IntegrationFixture | undefined;

    try {
        fixture = await createIntegrationFixture(rootDir, fixtureDir);
        const extensionDir = await fixture.build();

        session = await startBrowserSession("chrome", rootDir, extensionDir, {createPage: false});
        browser = session.chrome!;
        const debuggingPort = session.port;
        const extensionId = session.extensionId;

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
                )}; Chrome output: ${session?.output ?? ""}`
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
        await session?.close();

        await fixture?.dispose();
    }
});
