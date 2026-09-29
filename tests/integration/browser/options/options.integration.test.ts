import {readFile} from "fs/promises";
import path from "path";

import {targets} from "../utils/chrome";
import {startBrowserSession, type BrowserSession} from "../utils/session";
import CdpClient from "../utils/CdpClient";
import {waitFor} from "../utils/browser";
import {createIntegrationFixture, type IntegrationFixture} from "../../utils/fixture";

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");

jest.setTimeout(90_000);

test.each([
    {adapter: "vanilla", page: "options.html", title: "Vanilla Options", help: "help.html"},
    {adapter: "react", page: "ui/preferences.options.html", title: "React Options", help: "ui/help.html"},
])("Chrome MV3 opens and renders $adapter options from the background", async ({adapter, page, title, help}) => {
    const fixtureDir = path.join(__dirname, adapter);
    let session: BrowserSession | undefined;
    let browser: CdpClient | undefined;
    let fixture: IntegrationFixture | undefined;

    try {
        fixture = await createIntegrationFixture(rootDir, fixtureDir);
        const extensionDir = await fixture.build();

        const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
        const optionsHtml = await readFile(path.join(extensionDir, page), "utf8");
        const helpHtml = await readFile(path.join(extensionDir, help), "utf8");

        expect(manifest.manifest_version).toBe(3);
        expect(manifest.options_ui).toEqual({page, open_in_tab: true});
        expect(manifest.options_page).toBeUndefined();
        expect(optionsHtml).toContain("common.view.js");
        expect(helpHtml).toContain("common.view.js");

        session = await startBrowserSession("chrome", rootDir, extensionDir, {createPage: false});
        browser = session.chrome!;
        const debuggingPort = session.port;
        const extensionId = session.extensionId;

        if (!extensionId) {
            throw new Error("Chrome did not return an extension ID after loading the Options fixture");
        }

        const evaluate = async (sessionId: string, expression: string): Promise<any> => {
            const result = await browser!.send(
                "Runtime.evaluate",
                {expression, awaitPromise: true, returnByValue: true},
                sessionId
            );

            if (result.exceptionDetails) {
                throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
            }

            return result.result.value;
        };

        const worker = await waitFor(async () => {
            return (await targets(debuggingPort)).find(
                target =>
                    target.type === "service_worker" &&
                    target.url === `chrome-extension://${extensionId}/${manifest.background.service_worker}`
            );
        });

        const {sessionId: workerSessionId} = await browser.send("Target.attachToTarget", {
            targetId: worker.id,
            flatten: true,
        });

        await browser.send("Runtime.enable", {}, workerSessionId);

        await waitFor(async () => {
            return (await evaluate(workerSessionId, "globalThis.__adnbnOptionsReady === true")) ? true : undefined;
        });

        await evaluate(workerSessionId, "chrome.runtime.openOptionsPage()");

        const optionsTarget = await waitFor(async () => {
            return (await targets(debuggingPort)).find(
                target => target.type === "page" && target.url === `chrome-extension://${extensionId}/${page}`
            );
        });

        const {sessionId: optionsSessionId} = await browser.send("Target.attachToTarget", {
            targetId: optionsTarget.id,
            flatten: true,
        });

        await browser.send("Runtime.enable", {}, optionsSessionId);

        const rendered = await waitFor(async () => {
            return (
                (await evaluate(
                    optionsSessionId,
                    `(() => {
                        const root = document.querySelector('[data-testid="options"]');
                        if (!root) return null;
                        return {
                            adapter: root.dataset.adapter,
                            title: document.title,
                            count: root.querySelector('[data-testid="count"]')?.textContent,
                            color: getComputedStyle(root).color,
                            topLevel: window === window.top,
                        };
                    })()`
                )) ?? undefined
            );
        });

        expect(rendered).toEqual({adapter, title, count: "0", color: "rgb(31, 78, 121)", topLevel: true});

        await evaluate(optionsSessionId, "document.querySelector('[data-testid=increment]').click()");

        const count = await waitFor(async () => {
            const value = await evaluate(optionsSessionId, "document.querySelector('[data-testid=count]').textContent");

            return value === "1" ? value : undefined;
        });

        expect(count).toBe("1");
        expect(browser.runtimeErrors).toEqual([]);
    } catch (error) {
        throw new Error(
            `${error instanceof Error ? error.message : String(error)}; Runtime errors: ${JSON.stringify(
                browser?.runtimeErrors ?? []
            )}; Chrome output: ${session?.output ?? ""}`,
            {cause: error}
        );
    } finally {
        await session?.close();

        await fixture?.dispose();
    }
});
