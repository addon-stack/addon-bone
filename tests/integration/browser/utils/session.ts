import {spawn} from "child_process";
import {mkdtemp, rm} from "fs/promises";
import os from "os";
import path from "path";

import {getFreePort, stop} from "./browser";
import {browserVersion, findChromeBinary} from "./chrome";
import CdpClient from "./CdpClient";
import BidiClient from "./BidiClient";
import {findFirefoxBinary} from "./firefox";
import {waitForBrowserStartup} from "./startup";

interface BrowserSessionOptions {
    startupTimeout?: number;
    createPage?: boolean;
    firefoxEvents?: string[];
}

/** Owns the browser process, protocol connection and temporary profile. */
export const startBrowserSession = async (
    name: "chrome" | "firefox",
    rootDir: string,
    extensionDir: string,
    {startupTimeout = 30_000, createPage = true, firefoxEvents = []}: BrowserSessionOptions = {}
) => {
    const binary = name === "chrome" ? findChromeBinary(rootDir) : findFirefoxBinary();

    if (!binary || !path.isAbsolute(binary)) {
        throw new Error(`Install ${name} or set its ADNBN_*_BIN path`);
    }

    const port = await getFreePort();
    const profile = await mkdtemp(path.join(os.tmpdir(), "adnbn-browser-"));

    const args =
        name === "chrome"
            ? [
                  "--headless=new",
                  "--no-sandbox",
                  "--no-first-run",
                  "--no-default-browser-check",
                  "--enable-logging=stderr",
                  "--v=0",
                  `--remote-debugging-port=${port}`,
                  `--user-data-dir=${profile}`,
                  "about:blank",
              ]
            : [
                  "--headless",
                  "--no-remote",
                  "--profile",
                  profile,
                  "--remote-debugging-port",
                  String(port),
                  "about:blank",
              ];

    const startedAt = performance.now();
    const process = spawn(binary, args, {stdio: ["ignore", "ignore", "pipe"]});
    let output = "";
    let spawnError: Error | undefined;

    process.once("error", error => {
        spawnError = error;
    });

    process.stderr?.on("data", chunk => {
        output += chunk;
    });

    let chrome: CdpClient | undefined;
    let firefox: BidiClient | undefined;

    const close = async () => {
        try {
            await chrome?.close();

            if (firefox) {
                await firefox.send("session.end", {}, 2000).catch(() => undefined);
                await firefox.close();
            }
        } finally {
            try {
                if (process.pid) {
                    await stop(process);
                }
            } finally {
                await rm(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
            }
        }
    };

    let startupReported = false;

    const reportStartup = (status: "ready" | "failed", error?: unknown) => {
        startupReported = true;

        console.info(
            "[browser-startup] " +
                JSON.stringify({
                    browser: name,
                    testName: expect.getState().currentTestName,
                    durationMs: Math.round(performance.now() - startedAt),
                    timeoutMs: startupTimeout,
                    status,
                    ...(error ? {error: String(error)} : {}),
                })
        );
    };

    try {
        const version = await waitForBrowserStartup(
            async remaining => {
                if (name === "chrome") {
                    const {webSocketDebuggerUrl} = await browserVersion(port, Math.min(5_000, remaining()));
                    chrome = await CdpClient.connect(webSocketDebuggerUrl, remaining());

                    try {
                        return (await chrome.send("Browser.getVersion", {}, undefined, remaining())).product as string;
                    } catch (error) {
                        await chrome.close();
                        chrome = undefined;

                        throw error;
                    }
                }

                firefox = await BidiClient.connect(`ws://127.0.0.1:${port}/session`, Math.min(1_000, remaining()));

                try {
                    const session = await firefox.send("session.new", {capabilities: {alwaysMatch: {}}}, remaining());

                    return "Firefox/" + session.capabilities.browserVersion;
                } catch (error) {
                    await firefox.close();
                    firefox = undefined;

                    throw error;
                }
            },
            {
                timeout: startupTimeout,
                startedAt,
                description: `${name} startup`,
                checkProcess: () => {
                    if (spawnError) {
                        throw spawnError;
                    }

                    if (process.exitCode !== null || process.signalCode !== null) {
                        throw new Error(`${name} exited before startup: ${process.exitCode ?? process.signalCode}`);
                    }
                },
            }
        );

        reportStartup("ready");

        let extensionId: string;

        let navigate: (url: string) => Promise<unknown> = async () => {
            throw new Error("This session delegates page creation to the test");
        };

        let evaluate: (expression: string) => Promise<any> = navigate;

        if (chrome) {
            extensionId = (await chrome.send("Extensions.loadUnpacked", {path: extensionDir})).id;

            if (createPage) {
                const {targetId} = await chrome.send("Target.createTarget", {url: "about:blank"});
                const {sessionId} = await chrome.send("Target.attachToTarget", {targetId, flatten: true});

                await chrome.send("Runtime.enable", {}, sessionId);
                await chrome.send("Page.enable", {}, sessionId);
                navigate = url => chrome!.send("Page.navigate", {url}, sessionId);

                evaluate = async expression => {
                    const result = await chrome!.send(
                        "Runtime.evaluate",
                        {expression, awaitPromise: true, returnByValue: true},
                        sessionId
                    );

                    if (result.exceptionDetails) {
                        throw new Error(JSON.stringify(result.exceptionDetails));
                    }

                    return result.result.value;
                };
            }
        } else {
            if (firefoxEvents.length) {
                await firefox!.send("session.subscribe", {events: firefoxEvents});
            }

            extensionId = (
                await firefox!.send("webExtension.install", {
                    extensionData: {path: extensionDir, type: "path"},
                })
            ).extension;

            if (createPage) {
                const {context} = await firefox!.send("browsingContext.create", {type: "tab"});

                navigate = url => firefox!.send("browsingContext.navigate", {context, url, wait: "complete"});
                evaluate = expression => firefox!.evaluate(context, expression);
            }
        }

        return {
            version,
            extensionId,
            port,
            chrome,
            firefox,
            navigate,
            evaluate,
            close,
            get output() {
                return output;
            },
            get errors() {
                return chrome?.runtimeErrors ?? firefox?.runtimeErrors ?? [];
            },
        };
    } catch (error) {
        if (!startupReported) {
            reportStartup("failed", error);
        }

        try {
            await close();
        } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], `${name} failed; browser output: ${output}`);
        }

        throw new Error(`${String(error)}; browser output: ${output}`, {cause: error});
    }
};

export type BrowserSession = Awaited<ReturnType<typeof startBrowserSession>>;
