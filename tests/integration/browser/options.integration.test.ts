/** @jest-environment node */

import {mkdir, mkdtemp, readFile, rm, symlink} from "fs/promises";
import os from "os";
import path from "path";
import {spawn, type ChildProcess} from "child_process";

import {browserVersion, CdpClient, findChromeBinary, getFreePort, run, stop, targets, waitFor} from "./utils/chrome";

const rootDir = path.resolve(__dirname, "..", "..", "..");
const fixturesDir = path.join(__dirname, "options");
const chromeBinary = findChromeBinary(rootDir);
const artifactDir = (fixtureDir: string, browser = "chrome", manifestVersion = 3): string =>
    path.join(fixtureDir, "dist", `myapp-${browser}-mv${manifestVersion}`);

const buildFixture = async (
    fixtureDir: string,
    {
        react = false,
        browser = "chrome",
        manifestVersion = 3,
    }: {react?: boolean; browser?: string; manifestVersion?: 2 | 3} = {}
): Promise<void> => {
    const modulesDir = path.join(fixtureDir, "node_modules");

    await mkdir(modulesDir, {recursive: true});
    await symlink(rootDir, path.join(modulesDir, "adnbn"), "dir");

    if (react) {
        for (const dependency of ["react", "react-dom", "scheduler"]) {
            await symlink(path.join(rootDir, "node_modules", dependency), path.join(modulesDir, dependency), "dir");
        }
    }

    await run(
        process.execPath,
        [
            path.join(rootDir, "bin", "adnbn.js"),
            "build",
            ".",
            "-b",
            browser,
            ...(manifestVersion === 2 ? ["--mv2"] : []),
        ],
        fixtureDir
    );
};

const cleanFixture = async (fixtureDir: string): Promise<void> => {
    for (const directory of ["node_modules", ".adnbn", "dist"]) {
        await rm(path.join(fixtureDir, directory), {recursive: true, force: true});
    }
};

jest.setTimeout(90_000);

test.each([
    {adapter: "vanilla", page: "options.html", title: "Vanilla Options", help: "help.html"},
    {adapter: "react", page: "ui/preferences.options.html", title: "React Options", help: "ui/help.html"},
])("Chrome MV3 opens and renders $adapter options from the background", async ({adapter, page, title, help}) => {
    if (!chromeBinary || !path.isAbsolute(chromeBinary)) {
        throw new Error(
            "Chrome is not installed or could not be found. Install Chrome or set ADNBN_CHROME_BIN to its absolute executable path."
        );
    }

    const fixtureDir = path.join(fixturesDir, adapter);
    const extensionDir = artifactDir(fixtureDir);
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), `adnbn-options-${adapter}-`));
    const debuggingPort = await getFreePort();
    let chrome: ChildProcess | undefined;
    let browser: CdpClient | undefined;
    let chromeOutput = "";

    try {
        await buildFixture(fixtureDir, {react: adapter === "react"});

        const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
        const optionsHtml = await readFile(path.join(extensionDir, page), "utf8");
        const helpHtml = await readFile(path.join(extensionDir, help), "utf8");

        expect(manifest.manifest_version).toBe(3);
        expect(manifest.options_ui).toEqual({page, open_in_tab: true});
        expect(manifest.options_page).toBeUndefined();
        expect(optionsHtml).toContain("common.view.js");
        expect(helpHtml).toContain("common.view.js");

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
            )}; Chrome output: ${chromeOutput}`,
            {cause: error}
        );
    } finally {
        await browser?.close();

        if (chrome) {
            await stop(chrome);
        }

        await cleanFixture(fixtureDir);
        await rm(userDataDir, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
});

describe.each(["chrome", "edge", "opera", "safari", "firefox"])("%s options manifest", browser => {
    test.each([2, 3] as const)("MV%s build preserves explicit openInTab false", async manifestVersion => {
        const fixtureDir = path.join(fixturesDir, "embedded");

        try {
            await buildFixture(fixtureDir, {browser, manifestVersion});

            const extensionDir = artifactDir(fixtureDir, browser, manifestVersion);
            const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));

            expect(manifest.manifest_version).toBe(manifestVersion);
            expect(manifest.options_ui).toEqual({page: "options.html", open_in_tab: false});
            expect(manifest.options_page).toBeUndefined();
            expect(await readFile(path.join(extensionDir, manifest.options_ui.page), "utf8")).toContain("<script");
        } finally {
            await cleanFixture(fixtureDir);
        }
    });
});
