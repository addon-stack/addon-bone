import {jest} from "@jest/globals";

import {mkdir, mkdtemp, rm, writeFile} from "fs/promises";
import os from "os";
import path from "path";

import CdpPipeClient from "../utils/CdpPipeClient";
import {launchChromePipe, requireChromeBinary} from "../utils/chrome-pipe";
import {startProbeHub, type ProbeHub} from "../utils/probe-hub";
import {writeProbeExtension, writeThrowingExtension} from "../utils/probe-extension";
import {waitFor} from "../../browser/utils/browser";
import {startIntegrationSite, type IntegrationSite} from "../../browser/utils/site";

// Platform facts the `adnbn dev` session depends on. A failure here means Chrome changed a behaviour the reload
// strategy relies on, not that the framework regressed.

const rootDir = path.resolve(import.meta.dirname, "..", "..", "..", "..");

jest.setTimeout(90_000);

let binary: string;
let workDir: string;
let hub: ProbeHub;
let site: IntegrationSite;
const browsers: CdpPipeClient[] = [];

const launch = (profile: string): CdpPipeClient => {
    const browser = launchChromePipe(binary, path.join(workDir, profile));

    browsers.push(browser);

    return browser;
};

const loadUnpacked = async (browser: CdpPipeClient, directory: string): Promise<string> => {
    const {id} = await browser.send("Extensions.loadUnpacked", {path: directory});

    return id;
};

beforeAll(async () => {
    binary = requireChromeBinary(rootDir);
    workDir = await mkdtemp(path.join(os.tmpdir(), "adnbn-dev-probe-"));
    hub = await startProbeHub();

    const siteDir = path.join(workDir, "site");

    await mkdir(siteDir, {recursive: true});
    await writeFile(path.join(siteDir, "top.html"), "<!doctype html><title>Probe site</title><p>site</p>");
    site = await startIntegrationSite(siteDir, null);
});

// Cleanup must also run when beforeAll stopped early, for example without a Chrome binary.
afterEach(async () => {
    await Promise.all(browsers.splice(0).map(browser => browser.close()));

    if (hub) {
        hub.messages.length = 0;
    }
});

afterAll(async () => {
    await hub?.close();
    await site?.close();

    if (workDir) {
        await rm(workDir, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
});

test("loads an unpacked extension over the DevTools pipe and reloads it in place with its storage", async () => {
    const extension = path.join(workDir, "reload-in-place");

    await writeProbeExtension(extension, {version: "v1", hubPort: hub.port});

    const browser = launch("profile-reload-in-place");
    const {product} = await browser.send("Browser.getVersion");
    const id = await loadUnpacked(browser, extension);

    expect(product).toMatch(/^(Headless)?Chrome\//);

    const first = await hub.waitMessage(m => m.type === "storage" && m.version === "v1", "first storage report");

    await writeProbeExtension(extension, {version: "v2", hubPort: hub.port});

    expect(await loadUnpacked(browser, extension)).toBe(id);

    const second = await hub.waitMessage(m => m.type === "storage" && m.version === "v2", "storage after reload");

    expect(second.count).toBe(Number(first.count) + 1);
});

test("connects the service worker to a loopback WebSocket without host permissions", async () => {
    const extension = path.join(workDir, "loopback");
    const csp = `script-src 'self'; object-src 'self'; connect-src 'self' ws://127.0.0.1:${hub.port}`;

    await writeProbeExtension(extension, {version: "csp", hubPort: hub.port, csp});

    const browser = launch("profile-loopback");
    const id = await loadUnpacked(browser, extension);
    const hello = await hub.waitMessage(m => m.role === "background" && m.version === "csp", "background hello");

    expect(hello.origin).toBe(`chrome-extension://${id}`);
});

test("reports a service worker top-level exception through browser-level auto-attach", async () => {
    const extension = path.join(workDir, "throwing");
    const exceptions: string[] = [];

    await writeThrowingExtension(extension, "probe top-level failure");

    const browser = launch("profile-throwing");

    browser.on(message => {
        if (message.method === "Target.attachedToTarget") {
            const {sessionId} = message.params as {sessionId: string};

            void browser
                .send("Runtime.enable", {}, sessionId)
                .then(() => browser.send("Runtime.runIfWaitingForDebugger", {}, sessionId))
                .catch(() => undefined);
        }

        if (message.method === "Runtime.exceptionThrown") {
            const details = message.params?.exceptionDetails as {exception?: {description?: string}; text?: string};

            exceptions.push(details.exception?.description ?? details.text ?? "");
        }
    });

    await browser.send("Target.setAutoAttach", {
        autoAttach: true,
        waitForDebuggerOnStart: true,
        flatten: true,
        filter: [{type: "service_worker"}, {exclude: true}],
    });

    const id = await loadUnpacked(browser, extension);
    const exception = await waitFor(
        async () => exceptions.find(text => text.includes("probe top-level failure")),
        15_000,
        "the service worker exception"
    );

    expect(exception).toContain(`chrome-extension://${id}/sw.js`);
});

test("orphans content and closes extension tabs on reload; reloading a known tab needs no tabs permission", async () => {
    const extension = path.join(workDir, "orphans");

    await writeProbeExtension(extension, {version: "v1", hubPort: hub.port});

    const browser = launch("profile-orphans");
    const id = await loadUnpacked(browser, extension);

    await hub.waitMessage(m => m.role === "background" && m.version === "v1", "background v1");

    const {targetId: siteTarget} = await browser.send("Target.createTarget", {url: `${site.origin}/`});
    const content = await hub.waitMessage(m => m.role === "content" && m.version === "v1", "content v1");
    const {targetId: optionsTarget} = await browser.send("Target.createTarget", {
        url: `chrome-extension://${id}/options.html`,
    });

    await hub.waitMessage(m => m.role === "options" && m.version === "v1", "options v1");

    const {sessionId} = await browser.send("Target.attachToTarget", {targetId: siteTarget, flatten: true});
    const attribute = async (name: string): Promise<string | null> => {
        const {result} = await browser.send(
            "Runtime.evaluate",
            {expression: `document.documentElement.getAttribute(${JSON.stringify(name)})`, returnByValue: true},
            sessionId
        );

        return result.value;
    };

    await writeProbeExtension(extension, {version: "v2", hubPort: hub.port});
    await loadUnpacked(browser, extension);
    await hub.waitMessage(m => m.role === "background" && m.version === "v2", "background v2");

    await waitFor(
        async () => ((await attribute("data-probe-alive-v1")) === "false" ? true : undefined),
        5_000,
        "the old content script to lose its extension context"
    );

    const {targetInfos} = await browser.send("Target.getTargets");

    expect(targetInfos.some((target: {targetId: string}) => target.targetId === optionsTarget)).toBe(false);
    expect(await attribute("data-probe-content-v2")).toBeNull();

    hub.sendToLatest({type: "reloadTabs", tabs: [content.tabId]});

    const reloaded = await hub.waitMessage(m => m.type === "reloaded" || m.type === "reloadError", "tab reload");
    const next = await hub.waitMessage(m => m.role === "content" && m.version === "v2", "content v2");

    expect(reloaded.type).toBe("reloaded");
    expect(next.tabId).toBe(content.tabId);
    expect(next.documentId).not.toBe(content.documentId);
});

test("forgets the extension after a restart but restores its id and storage when loaded again", async () => {
    const extension = path.join(workDir, "restart");

    await writeProbeExtension(extension, {version: "restart", hubPort: hub.port});

    const first = launch("profile-restart");
    const id = await loadUnpacked(first, extension);

    await hub.waitMessage(m => m.type === "storage" && m.count === 1, "storage before restart");
    await first.close();
    hub.messages.length = 0;

    const second = launch("profile-restart");
    const {extensions} = await second.send("Extensions.getExtensions");

    expect(extensions).toEqual([]);
    expect(await loadUnpacked(second, extension)).toBe(id);

    await hub.waitMessage(m => m.type === "storage" && m.count === 2, "storage after restart");
});

test("exits when the DevTools pipe closes", async () => {
    const browser = launch("profile-pipe");

    await browser.send("Browser.getVersion");
    browser.closePipe();

    expect(await browser.waitForExit(10_000)).toBeDefined();
});
