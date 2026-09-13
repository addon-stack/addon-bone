import {spawn} from "child_process";
import {mkdtemp, rm} from "fs/promises";
import os from "os";
import path from "path";

import {getFreePort, stop, waitFor} from "./browser";
import {browserVersion, CdpClient, findChromeBinary} from "./chrome";
import BidiClient from "./BidiClient";
import {findFirefoxBinary} from "./firefox";

/** A real extension browser session; owns its process, connection and temporary profile. */
export const startBrowserSession = async (name: "chrome" | "firefox", rootDir: string, extensionDir: string) => {
    const binary = name === "chrome" ? findChromeBinary(rootDir) : findFirefoxBinary();
    if (!binary || !path.isAbsolute(binary)) throw new Error(`Install ${name} or set its ADNBN_*_BIN path`);
    const port = await getFreePort();
    const profile = await mkdtemp(path.join(os.tmpdir(), "adnbn-isolation-"));
    const args =
        name === "chrome"
            ? [
                  "--headless=new",
                  "--no-sandbox",
                  "--no-first-run",
                  "--no-default-browser-check",
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
    const process = spawn(binary, args, {stdio: ["ignore", "ignore", "pipe"]});
    let output = "";
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
            await stop(process);
            await rm(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
        }
    };
    try {
        let version: string;
        let navigate: (url: string) => Promise<unknown>;
        let evaluate: (expression: string) => Promise<any>;
        if (name === "chrome") {
            const {webSocketDebuggerUrl} = await waitFor(() => browserVersion(port));
            chrome = await CdpClient.connect(webSocketDebuggerUrl);
            version = (await chrome.send("Browser.getVersion")).product;
            await chrome.send("Extensions.loadUnpacked", {path: extensionDir});
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
                if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
                return result.result.value;
            };
        } else {
            firefox = await waitFor(() => BidiClient.connect(`ws://127.0.0.1:${port}/session`));
            const session = await firefox.send("session.new", {capabilities: {alwaysMatch: {}}});
            version = "Firefox/" + session.capabilities.browserVersion;
            await firefox.send("webExtension.install", {extensionData: {path: extensionDir, type: "path"}});
            const {context} = await firefox.send("browsingContext.create", {type: "tab"});
            navigate = url => firefox!.send("browsingContext.navigate", {context, url, wait: "complete"});
            evaluate = expression => firefox!.evaluate(context, expression);
        }
        return {
            version,
            navigate,
            evaluate,
            close,
            get errors() {
                return chrome?.runtimeErrors ?? firefox?.runtimeErrors ?? [];
            },
        };
    } catch (error) {
        await close();
        throw new Error(`${String(error)}; browser output: ${output}`, {cause: error});
    }
};
