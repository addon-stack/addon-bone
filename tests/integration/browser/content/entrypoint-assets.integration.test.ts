/** @jest-environment node */

import {mkdtemp, readFile, rm, stat} from "fs/promises";
import os from "os";
import path from "path";
import {spawn, type ChildProcess} from "child_process";

import {browserVersion, CdpClient, findChromeBinary, targets} from "../utils/chrome";
import {getFreePort, stop, waitFor} from "../utils/browser";
import {startIntegrationSite, type IntegrationSite} from "../utils/site";
import {createIntegrationFixture, type IntegrationFixture} from "../../utils/fixture";

import {DocumentStateExpression, expectLoadedProbe, type DocumentState} from "./utils";

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
const fixtureDir = path.join(__dirname, "entrypoint-assets");
const chromeBinary = findChromeBinary(rootDir);

const evaluate = async (browser: CdpClient, sessionId: string, expression: string): Promise<any> => {
    const result = await browser.send(
        "Runtime.evaluate",
        {expression, awaitPromise: true, returnByValue: true},
        sessionId
    );

    if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }

    return result.result.value;
};

const readDocumentState = async (browser: CdpClient, sessionId: string): Promise<DocumentState> => {
    return evaluate(browser, sessionId, `${DocumentStateExpression}(document)`);
};

const waitForLoadedDocument = async (browser: CdpClient, sessionId: string): Promise<DocumentState> => {
    let lastState: DocumentState | undefined;

    try {
        return await waitFor(async () => {
            lastState = await readDocumentState(browser, sessionId);
            const statuses = [lastState.isolated?.async, lastState.main?.async];

            return statuses.every(status => status !== undefined && status !== "pending") ? lastState : undefined;
        });
    } catch (error) {
        throw new Error(
            `${error instanceof Error ? error.message : String(error)}; last document state: ${JSON.stringify(lastState)}`,
            {cause: error}
        );
    }
};

jest.setTimeout(90_000);

test("Chrome MV3 loads ISOLATED chunks lazily and keeps MAIN dynamic imports in the initial graph", async () => {
    if (!chromeBinary || !path.isAbsolute(chromeBinary)) {
        throw new Error(
            "Chrome is not installed or could not be found. Install Chrome or set ADNBN_CHROME_BIN to its absolute executable path."
        );
    }

    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "adnbn-content-entrypoint-assets-"));
    const debuggingPort = await getFreePort();
    let chrome: ChildProcess | undefined;
    let browser: CdpClient | undefined;
    let site: IntegrationSite | undefined;
    let fixture: IntegrationFixture | undefined;
    let chromeOutput = "";

    try {
        fixture = await createIntegrationFixture(rootDir, fixtureDir);
        const extensionDir = await fixture.build();

        const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
        const contentScripts = manifest.content_scripts as Array<{css?: string[]; js: string[]; world?: string}>;
        const backgroundFile = manifest.background.service_worker as string;
        const resources = (manifest.web_accessible_resources ?? []).flatMap(
            (item: {resources?: string[]}) => item.resources ?? []
        );

        expect(contentScripts).toHaveLength(4);
        expect(contentScripts.map(script => script.world).sort()).toEqual(["ISOLATED", "ISOLATED", "MAIN", "MAIN"]);
        expect(contentScripts.every(script => !script.js.includes(backgroundFile))).toBe(true);

        const isolatedScripts = contentScripts.filter(script => script.world === "ISOLATED");
        const mainScripts = contentScripts.filter(script => script.world === "MAIN");
        const sharedFiles = (scripts: Array<{js: string[]}>): string[] => {
            return scripts[0].js.filter(file => scripts.slice(1).every(script => script.js.includes(file)));
        };

        expect(sharedFiles(isolatedScripts)).toEqual([expect.stringMatching(/^js\/common\.content\..+\.js$/)]);
        expect(sharedFiles(mainScripts)).toEqual([expect.stringMatching(/^js\/common-main\.content\..+\.js$/)]);

        for (const isolated of isolatedScripts) {
            for (const main of mainScripts) {
                expect(isolated.js.filter(file => main.js.includes(file))).toEqual([]);
            }
        }
        expect(resources.some((file: string) => /^assets\/probe-[a-f0-9]{4}\.svg$/.test(file))).toBe(true);
        expect(resources.some((file: string) => /^js\/.+\.js$/.test(file))).toBe(true);
        expect(resources.some((file: string) => /^css\/.+\.css$/.test(file))).toBe(true);

        for (const script of contentScripts) {
            for (const file of [...script.js, ...(script.css ?? [])]) {
                await expect(stat(path.join(extensionDir, file))).resolves.toBeDefined();
            }
        }

        site = await startIntegrationSite(path.join(fixture.directory, "site"));
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
            throw new Error("Chrome did not return an extension ID after loading the content fixture");
        }

        const worker = await waitFor(async () => {
            return (await targets(debuggingPort)).find(
                target =>
                    target.type === "service_worker" &&
                    target.url === `chrome-extension://${extensionId}/${backgroundFile}`
            );
        });
        const {sessionId: workerSessionId} = await browser.send("Target.attachToTarget", {
            targetId: worker.id,
            flatten: true,
        });

        await browser.send("Runtime.enable", {}, workerSessionId);
        await waitFor(async () => {
            return (await evaluate(
                browser!,
                workerSessionId,
                "globalThis.__adnbnContentBuildAssetsBackgroundReady === true"
            ))
                ? true
                : undefined;
        });

        const {targetId} = await browser.send("Target.createTarget", {url: "about:blank"});
        const {sessionId} = await browser.send("Target.attachToTarget", {targetId, flatten: true});

        await browser.send("Runtime.enable", {}, sessionId);
        await browser.send("Page.enable", {}, sessionId);
        await browser.send("Page.navigate", {url: `${site.origin}/top.html`}, sessionId);

        const top = await waitForLoadedDocument(browser, sessionId);

        expectLoadedProbe(top.isolated, "ISOLATED", "top", true);
        expectLoadedProbe(top.main, "MAIN", "top", false);
        expect(top.isolatedGlobal).toBe(false);
        expect(top.mainGlobal).toBe(true);
        expect(top.isolatedSecondaryRuns).toBe("1");
        expect(top.mainSecondaryRuns).toBe("1");

        await browser.send("Page.navigate", {url: `${site.origin}/frames.html`}, sessionId);

        const framed = await waitFor(async () => {
            const state = await evaluate(
                browser!,
                sessionId,
                `(() => {
                    const frame = document.querySelector('[data-testid="child-frame"]');
                    const child = frame?.contentDocument;

                    if (!child || child.readyState !== 'complete') return undefined;

                    return {
                        top: ${DocumentStateExpression}(document),
                        child: ${DocumentStateExpression}(child),
                    };
                })()`
            );
            const statuses = [
                state?.top?.isolated?.async,
                state?.top?.main?.async,
                state?.child?.isolated?.async,
                state?.child?.main?.async,
            ];

            return statuses.every(status => status !== undefined && status !== "pending") ? state : undefined;
        });

        expectLoadedProbe(framed.top.isolated, "ISOLATED", "top", true);
        expectLoadedProbe(framed.top.main, "MAIN", "top", false);
        expectLoadedProbe(framed.child.isolated, "ISOLATED", "child", true);
        expectLoadedProbe(framed.child.main, "MAIN", "child", false);
        expect(framed.top.isolatedGlobal).toBe(false);
        expect(framed.top.mainGlobal).toBe(true);
        expect(framed.child.isolatedGlobal).toBe(false);
        expect(framed.child.mainGlobal).toBe(true);
        expect(framed.top.isolatedSecondaryRuns).toBe("1");
        expect(framed.top.mainSecondaryRuns).toBe("1");
        expect(framed.child.isolatedSecondaryRuns).toBe("1");
        expect(framed.child.mainSecondaryRuns).toBe("1");
        expect(browser.runtimeErrors).toEqual([]);
    } catch (error) {
        throw new Error(
            `${error instanceof Error ? error.message : String(error)}; Runtime errors: ${JSON.stringify(
                browser?.runtimeErrors ?? []
            )}; Chrome output: ${chromeOutput}`,
            {cause: error}
        );
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
