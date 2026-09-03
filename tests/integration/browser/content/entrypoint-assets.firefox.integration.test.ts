/** @jest-environment node */

import {mkdtemp, readFile, rm, stat} from "fs/promises";
import os from "os";
import path from "path";
import {spawn, type ChildProcess} from "child_process";

import BidiClient from "../utils/BidiClient";
import {findFirefoxBinary} from "../utils/firefox";
import {getFreePort, stop, waitFor} from "../utils/browser";
import {startIntegrationSite, type IntegrationSite} from "../utils/site";
import {createIntegrationFixture, type IntegrationFixture} from "../../utils/fixture";
import {DocumentStateExpression, expectLoadedProbe, type DocumentState} from "./utils";

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
const fixtureDir = path.join(__dirname, "entrypoint-assets");

interface FrameState {
    top: DocumentState;
    child: DocumentState;
}

jest.setTimeout(90_000);

test.each([2, 3] as const)(
    "Firefox MV%s loads entrypoint assets in the effective execution world",
    async manifestVersion => {
        const firefoxBinary = findFirefoxBinary();

        if (!firefoxBinary || !path.isAbsolute(firefoxBinary)) {
            throw new Error(
                "Firefox is not installed. Install Firefox or set ADNBN_FIREFOX_BIN to its absolute executable path."
            );
        }

        const userDataDir = await mkdtemp(path.join(os.tmpdir(), "adnbn-content-firefox-"));
        let firefox: ChildProcess | undefined;
        let browser: BidiClient | undefined;
        let fixture: IntegrationFixture | undefined;
        let site: IntegrationSite | undefined;
        let output = "";
        let lastState: DocumentState | FrameState | undefined;

        const expectDocument = (state: DocumentState, frame: string): void => {
            expectLoadedProbe(state.isolated, "ISOLATED", frame, true, "moz-extension:");
            // Probe names record the requested world. Page-global visibility verifies the effective world.
            expectLoadedProbe(state.main, "MAIN", frame, manifestVersion === 2, "moz-extension:");
            expect(state.isolatedGlobal).toBe(false);
            expect(state.mainGlobal).toBe(manifestVersion === 3);
            expect(state.isolatedSecondaryRuns).toBe("1");
            expect(state.mainSecondaryRuns).toBe("1");
        };

        try {
            fixture = await createIntegrationFixture(rootDir, fixtureDir);
            const extensionDir = await fixture.build({browser: "firefox", manifestVersion});
            const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
            const scripts = manifest.content_scripts as Array<{js: string[]; css?: string[]; world?: string}>;
            const resources =
                manifestVersion === 2
                    ? (manifest.web_accessible_resources as string[])
                    : (manifest.web_accessible_resources.flatMap(
                          (entry: {resources: string[]}) => entry.resources
                      ) as string[]);

            expect(manifest.manifest_version).toBe(manifestVersion);
            expect(scripts).toHaveLength(4);
            expect(manifest.background.scripts).toHaveLength(1);
            expect(scripts.every(script => !script.js.includes(manifest.background.scripts[0]))).toBe(true);

            if (manifestVersion === 2) {
                expect(scripts.every(script => script.world === undefined)).toBe(true);
                expect(
                    manifest.web_accessible_resources.every((resource: unknown) => typeof resource === "string")
                ).toBe(true);
                const common = scripts[0].js.filter(file => scripts.every(script => script.js.includes(file)));
                expect(common).toEqual([expect.stringMatching(/^js\/common\.content\..+\.js$/)]);
            } else {
                expect(scripts.map(script => script.world).sort()).toEqual(["ISOLATED", "ISOLATED", "MAIN", "MAIN"]);
                expect(
                    manifest.web_accessible_resources.every(
                        (entry: {resources: string[]; matches: string[]}) =>
                            Array.isArray(entry.resources) && Array.isArray(entry.matches)
                    )
                ).toBe(true);
            }

            expect(resources.some(file => /^js\/.+\.js$/.test(file))).toBe(true);
            expect(resources.some(file => /^css\/.+\.css$/.test(file))).toBe(true);
            expect(resources.some(file => /^assets\/probe-[a-f0-9]{4}\.svg$/.test(file))).toBe(true);

            for (const file of new Set([
                ...resources,
                ...scripts.flatMap(script => [...script.js, ...(script.css ?? [])]),
            ])) {
                await expect(stat(path.join(extensionDir, file))).resolves.toBeDefined();
            }

            site = await startIntegrationSite(path.join(fixture.directory, "site"));
            const port = await getFreePort();
            firefox = spawn(
                firefoxBinary,
                [
                    "--headless",
                    "--no-remote",
                    "--profile",
                    userDataDir,
                    "--remote-debugging-port",
                    String(port),
                    "about:blank",
                ],
                {stdio: ["ignore", "ignore", "pipe"]}
            );
            firefox.stderr?.on("data", chunk => (output += chunk));

            browser = await waitFor(() => BidiClient.connect(`ws://127.0.0.1:${port}/session`));
            const session = await browser.send("session.new", {capabilities: {alwaysMatch: {}}});
            console.info(`Firefox ${session.capabilities.browserVersion}: testing Manifest V${manifestVersion}`);
            await browser.send("session.subscribe", {events: ["log.entryAdded"]});
            const extension = await browser.send("webExtension.install", {
                extensionData: {path: extensionDir, type: "path"},
            });
            expect(typeof extension.extension).toBe("string");
            const {context} = await browser.send("browsingContext.create", {type: "tab"});

            await browser.send("browsingContext.navigate", {context, url: `${site.origin}/top.html`, wait: "complete"});
            const top = await waitFor(async () => {
                const state = await browser!.evaluate<DocumentState>(context, `${DocumentStateExpression}(document)`);
                lastState = state;
                const statuses = [state?.isolated?.async, state?.main?.async];
                return statuses.every(status => status !== undefined && status !== "pending") ? state : undefined;
            });
            expectDocument(top, "top");

            await browser.send("browsingContext.navigate", {
                context,
                url: `${site.origin}/frames.html`,
                wait: "complete",
            });
            const framed = await waitFor(async () => {
                const state = await browser!.evaluate<FrameState>(
                    context,
                    `(() => {
                const child = document.querySelector('[data-testid="child-frame"]')?.contentDocument;
                if (!child || child.readyState !== 'complete') return undefined;
                return {top: ${DocumentStateExpression}(document), child: ${DocumentStateExpression}(child)};
            })()`
                );
                lastState = state;
                const statuses = [
                    state?.top?.isolated?.async,
                    state?.top?.main?.async,
                    state?.child?.isolated?.async,
                    state?.child?.main?.async,
                ];
                return statuses.every(status => status !== undefined && status !== "pending") ? state : undefined;
            });
            expectDocument(framed.top, "top");
            expectDocument(framed.child, "child");
            expect(browser.runtimeErrors).toEqual([]);
        } catch (error) {
            throw new Error(
                `${error instanceof Error ? error.message : String(error)}; last state: ${JSON.stringify(lastState)}; Runtime errors: ${JSON.stringify(browser?.runtimeErrors ?? [])}; Firefox output: ${output}`,
                {cause: error}
            );
        } finally {
            if (browser) {
                try {
                    await browser.send("session.end", {}, 2_000);
                } catch {
                    // Firefox may close the socket before returning the session.end response.
                }
                await browser.close();
            }
            if (firefox) await stop(firefox);
            await site?.close();
            await fixture?.dispose();
            await rm(userDataDir, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
        }
    }
);
