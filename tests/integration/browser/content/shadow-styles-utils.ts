import {spawn, type ChildProcess} from "child_process";
import {mkdtemp, readFile, rm, stat, writeFile} from "fs/promises";
import os from "os";
import path from "path";

import {getFreePort, stop, waitFor} from "../utils/browser";
import {browserVersion, CdpClient, findChromeBinary} from "../utils/chrome";
import BidiClient from "../utils/BidiClient";
import {findFirefoxBinary} from "../utils/firefox";
import {startIntegrationSite, type IntegrationSite} from "../utils/site";
import {createIntegrationFixture, type IntegrationFixture} from "../../utils/fixture";

interface ShadowProbe {
    readonly anchor?: string;
    readonly asyncCss?: string;
    readonly error?: string;
    readonly font?: string;
    readonly frame?: string;
    readonly initialCss?: string;
    readonly instance?: string;
    readonly kind?: string;
    readonly links: string[];
    readonly ready?: string;
    readonly sharedCss?: string;
}

interface ShadowDocumentState {
    readonly normalBorder: string;
    readonly normalReady: boolean;
    readonly outsideColor: string;
    readonly pageUrl: string;
    readonly probes: ShadowProbe[];
}

interface FrameState {
    readonly child: ShadowDocumentState;
    readonly top: ShadowDocumentState;
}

const DocumentStateExpression = `(document => {
    const view = document.defaultView;
    const hosts = Array.from(document.querySelectorAll("[data-shadow-probe]"));
    const probes = hosts.map(host => {
        const root = host.shadowRoot;
        const result = root && root.querySelector("[data-shadow-result]");
        return {
            ...(result ? Object.fromEntries(Object.entries(result.dataset)) : {ready: "missing"}),
            instance: host.getAttribute("data-instance") || undefined,
            kind: host.getAttribute("data-shadow-probe") || undefined,
            links: root ? Array.from(root.querySelectorAll('link[rel="stylesheet"]'), link => link.href) : [],
        };
    });
    const primary = hosts.find(host => host.getAttribute("data-shadow-probe") === "primary");
    const primaryResult = primary && primary.shadowRoot && primary.shadowRoot.querySelector("[data-shadow-result]");
    const outside = document.querySelector("#outside");
    if (outside && primaryResult && outside.className !== primaryResult.className) {
        outside.className = primaryResult.className;
    }
    const normal = document.querySelector("[data-normal-probe]");
    return {
        pageUrl: document.location.href,
        probes,
        normalReady: normal?.getAttribute("data-normal-probe") === "ready",
        normalBorder: normal ? view.getComputedStyle(normal).borderTopWidth : "missing",
        outsideColor: outside ? view.getComputedStyle(outside).color : "missing",
    };
})`;

const StrictCsp =
    "default-src 'none'; style-src 'none'; style-src-elem 'none'; font-src 'none'; frame-src 'self'; img-src 'self'";

const isReady = (state: ShadowDocumentState | undefined, expected: number): state is ShadowDocumentState => {
    return (
        state !== undefined &&
        state.probes.length === expected &&
        state.probes.every(probe => probe.ready === "true" && !probe.error) &&
        state.normalReady
    );
};

const expectDocument = (state: ShadowDocumentState, frame: "top" | "child", primaryCount: number): void => {
    const primary = state.probes.filter(probe => probe.kind === "primary");
    const secondary = state.probes.filter(probe => probe.kind === "secondary");

    expect(primary).toHaveLength(primaryCount);
    expect(secondary).toHaveLength(1);
    expect(state.normalReady).toBe(true);
    expect(state.normalBorder).toBe("3px");
    expect(state.outsideColor).not.toBe("rgb(17, 85, 153)");

    for (const probe of state.probes) {
        expect(probe.frame).toBe(frame);
        expect(probe.initialCss).toBe("applied");
        expect(probe.asyncCss).toBe("applied");
        expect(probe.sharedCss).toBe("applied");
        expect(probe.links.length).toBeGreaterThanOrEqual(3);
        expect(probe.links.every(url => /^(chrome|moz)-extension:\/\//.test(url))).toBe(true);
    }

    expect(primary.every(probe => probe.font === "applied")).toBe(true);
};

export const runShadowStylesIntegration = async (name: "chrome" | "firefox", manifestVersion: 2 | 3): Promise<void> => {
    const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
    const binary = name === "chrome" ? findChromeBinary(rootDir) : findFirefoxBinary();
    if (!binary || !path.isAbsolute(binary)) throw new Error("Install " + name + " or set its ADNBN_*_BIN path");

    const profile = await mkdtemp(path.join(os.tmpdir(), "adnbn-shadow-integration-"));
    let browserProcess: ChildProcess | undefined;
    let chrome: CdpClient | undefined;
    let firefox: BidiClient | undefined;
    let fixture: IntegrationFixture | undefined;
    let site: IntegrationSite | undefined;
    let processOutput = "";
    let lastState: unknown;

    try {
        fixture = await createIntegrationFixture(rootDir, path.join(__dirname, "shadow-styles"));
        const extensionDir = await fixture.build({browser: name, manifestVersion});
        const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
        const scripts = manifest.content_scripts as Array<{css?: string[]; js: string[]}>;
        const resources: string[] =
            manifestVersion === 2
                ? manifest.web_accessible_resources
                : manifest.web_accessible_resources.flatMap((entry: {resources: string[]}) => entry.resources);
        const normal = scripts.find(script => (script.css?.length ?? 0) > 0);
        const shadows = scripts.filter(script => (script.css?.length ?? 0) === 0);

        expect(scripts).toHaveLength(3);
        expect(normal).toBeDefined();
        expect(shadows).toHaveLength(2);
        expect(scripts.every(script => script.js.every(file => !/background/i.test(file)))).toBe(true);
        const sharedCss = normal!.css!.find(file => resources.includes(file));
        expect(sharedCss).toMatch(/^css\/shared-styles\.[a-f0-9]{8}\.css$/);
        expect(resources.some(file => /^assets\/probe\.[a-f0-9]{8}\.woff2$/.test(file))).toBe(true);
        expect(resources.some(file => /^css\/.+\.[a-f0-9]{8}\.css$/.test(file))).toBe(true);

        for (const file of new Set([
            ...scripts.flatMap(script => [...script.js, ...(script.css ?? [])]),
            ...resources,
        ])) {
            await expect(stat(path.join(extensionDir, file))).resolves.toBeDefined();
        }

        const port = await getFreePort();
        let navigate: (url: string) => Promise<unknown>;
        let evaluate: (expression: string) => Promise<any>;
        let version: string;

        if (name === "chrome") {
            browserProcess = spawn(
                binary,
                [
                    "--headless=new",
                    "--no-sandbox",
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--remote-debugging-port=" + port,
                    "--user-data-dir=" + profile,
                    "about:blank",
                ],
                {stdio: ["ignore", "ignore", "pipe"]}
            );
            browserProcess.stderr?.on("data", chunk => (processOutput += chunk));
            const {webSocketDebuggerUrl} = await waitFor(() => browserVersion(port));
            chrome = await CdpClient.connect(webSocketDebuggerUrl);
            version = (await chrome.send("Browser.getVersion")).product;
            const extension = await chrome.send("Extensions.loadUnpacked", {path: extensionDir});
            expect(typeof extension.id).toBe("string");
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
            browserProcess = spawn(
                binary,
                [
                    "--headless",
                    "--no-remote",
                    "--profile",
                    profile,
                    "--remote-debugging-port",
                    String(port),
                    "about:blank",
                ],
                {stdio: ["ignore", "ignore", "pipe"]}
            );
            browserProcess.stderr?.on("data", chunk => (processOutput += chunk));
            firefox = await waitFor(() => BidiClient.connect("ws://127.0.0.1:" + port + "/session"));
            const session = await firefox.send("session.new", {capabilities: {alwaysMatch: {}}});
            version = "Firefox/" + session.capabilities.browserVersion;
            const extension = await firefox.send("webExtension.install", {
                extensionData: {path: extensionDir, type: "path"},
            });
            expect(typeof extension.extension).toBe("string");
            const {context} = await firefox.send("browsingContext.create", {type: "tab"});
            navigate = url => firefox!.send("browsingContext.navigate", {context, url, wait: "complete"});
            evaluate = expression => firefox!.evaluate(context, expression);
        }

        const measurements: Array<{policy: string; top: ShadowDocumentState; frames: FrameState}> = [];
        for (const policy of [null, StrictCsp]) {
            site = await startIntegrationSite(path.join(fixture.directory, "site"), policy);
            const topUrl = site.origin + "/top.html";
            const response = await fetch(topUrl);
            expect(response.headers.get("content-security-policy")).toBe(policy);
            await response.arrayBuffer();
            await navigate(topUrl);
            const top = await waitFor(async () => {
                const state = await evaluate(`${DocumentStateExpression}(document)`);
                lastState = state;
                return state?.pageUrl === topUrl && isReady(state, 3) ? state : undefined;
            }, 30_000);
            expectDocument(top, "top", 2);

            const oldInstance = Number(top.probes.find(probe => probe.anchor === "first")?.instance);
            await evaluate(`(() => {
                document.querySelector('[data-shadow-primary="first"]')?.remove();
                const replacement = document.createElement("div");
                replacement.setAttribute("data-shadow-primary", "first");
                document.body.append(replacement);
            })()`);
            const remounted = await waitFor(async () => {
                const state = await evaluate(`${DocumentStateExpression}(document)`);
                lastState = state;
                const instance = Number(state?.probes.find(probe => probe.anchor === "first")?.instance);
                return isReady(state, 3) && instance > oldInstance ? state : undefined;
            }, 30_000);
            expectDocument(remounted, "top", 2);

            const framesUrl = site.origin + "/frames.html";
            await navigate(framesUrl);
            const frames = await waitFor(async () => {
                const state = await evaluate(`(() => {
                    const child = document.querySelector('[data-testid="child-frame"]')?.contentDocument;
                    if (!child || child.readyState !== "complete") return undefined;
                    return {top: ${DocumentStateExpression}(document), child: ${DocumentStateExpression}(child)};
                })()`);
                lastState = state;
                return isReady(state?.top, 2) && isReady(state?.child, 2) ? state : undefined;
            }, 30_000);
            expectDocument(frames.top, "top", 1);
            expectDocument(frames.child, "child", 1);
            measurements.push({policy: policy === null ? "none" : "strict", top: remounted, frames});
            await site.close();
            site = undefined;
        }

        const report = {browser: version, manifestVersion, measurements};
        const reportPath = path.join(
            rootDir,
            ".cache",
            "integration",
            "shadow-styles-" + name + "-mv" + manifestVersion + ".json"
        );
        await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
        console.info(JSON.stringify(report, null, 2));
        expect(version).toMatch(new RegExp(`^${name === "chrome" ? "Chrome" : "Firefox"}\\/\\d+(?:\\.\\d+)+$`));
        expect(name === "chrome" ? chrome?.runtimeErrors : firefox?.runtimeErrors).toEqual([]);
    } catch (error) {
        throw new Error(
            `${error instanceof Error ? error.message : String(error)}; last state: ${JSON.stringify(lastState)}; runtime errors: ${JSON.stringify(chrome?.runtimeErrors ?? firefox?.runtimeErrors ?? [])}; browser output: ${processOutput}`,
            {cause: error}
        );
    } finally {
        await chrome?.close();
        if (firefox) {
            try {
                await firefox.send("session.end", {}, 2_000);
            } catch {
                // Firefox may close before replying.
            }
            await firefox.close();
        }
        if (browserProcess) await stop(browserProcess);
        await site?.close();
        await fixture?.dispose();
        await rm(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
};
