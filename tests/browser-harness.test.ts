jest.mock("#adnbn/locale", () => require("../src/locale/providers/tests/fixtures/dynamic"));

import {executeScript, getBrowserInfo, getManifest, sendMessage, sendTabMessage} from "@addon-core/browser";
import {createTabFixture} from "@addon-core/browser/testing";
import {Storage} from "@addon-core/storage";

import NativeLocale from "@locale/providers/NativeLocale";
import ObservableLocale from "@locale/providers/ObservableLocale";
import {MemoryLocaleStorage} from "@locale/tests/fixtures";
import OffscreenBridge from "@offscreen/OffscreenBridge";
import SandboxMessage from "@sandbox/SandboxMessage";
import {getApp, getBrowser, getManifestVersion, isBrowser} from "@main/env";
import {Browser} from "@typing/browser";
import MessageManager from "@message/MessageManager";
import Message from "@message/providers/Message";
import RelayManager from "@relay/RelayManager";
import {MessageGlobalKey} from "@typing/message";
import {RelayGlobalKey} from "@typing/relay";

import BrowserTestSession from "./browser-harness/BrowserTestSession";
import {getBrowserTest, stopBrowserTest} from "./browser-harness/session";

const hostSetTimeout = setTimeout;
const initialBrowser = process.env.BROWSER;
const initialChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");

test.each([1, 2])("starts test %i with fresh API state, call history and framework singletons", async () => {
    const {harness} = getBrowserTest();

    expect(harness.calls).toEqual([]);
    expect(harness.storage.local.data).toEqual({});
    expect(globalThis[MessageGlobalKey]).toBeUndefined();
    expect(globalThis[RelayGlobalKey]).toBeUndefined();
    expect(jest.isMockFunction(getManifest)).toBe(false);
    expect(jest.isMockFunction(Storage.Local)).toBe(false);

    await harness.chrome.storage.local.set({probe: 42});
    MessageManager.getInstance();
    RelayManager.getInstance();

    expect(harness.calls.length).toBeGreaterThan(0);
});

test("reads through the real Storage package and preserves browser failures", async () => {
    const {harness} = getBrowserTest();
    const storage = Storage.Local<{locale: string}>({namespace: "adnbn"});

    await expect(storage.get("locale")).resolves.toBeUndefined();
    harness.storage.local.get.failNext(new Error("Storage denied"));
    await expect(storage.get("locale")).rejects.toThrow("Storage denied");
});

test("registers real Message listeners in one context and restores the caller context", async () => {
    const session = getBrowserTest();
    const receiver = session.harness.contexts.create({kind: "background"});
    const restore = session.useContext(receiver);
    const message = new Message<{probe: () => number}>();

    message.watch("probe", () => 42);
    restore();

    await expect(message.send("probe", undefined)).resolves.toBe(42);
    await session.dispose();
    expect(receiver.onMessage.listenerCount()).toBe(0);
    expect(globalThis[MessageGlobalKey]).toBeUndefined();
});

test("disposes pending guest execution, listeners, framework caches and restores global descriptors", async () => {
    const session = getBrowserTest();

    await session.dispose();

    const previousChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");
    const current = new BrowserTestSession({
        tabs: [createTabFixture({id: 7})],
        documents: [{documentId: "main", tabId: 7, url: "https://example.test/"}],
    });

    try {
        const runtime = current.createScriptRuntime({clock: true});
        const pending = executeScript({
            target: {tabId: 7},
            func: () => new Promise(resolve => setTimeout(() => resolve("late"), 300)),
        });
        const rejected = expect(pending).rejects.toThrow(/disposed|cancelled by reset/);
        const manager = RelayManager.getInstance();

        manager.add("probe", {value: 42});
        current.harness.configurable.chrome.i18n.getMessage.setResult("en");

        const locale = NativeLocale.getInstance();
        const message = Message.getInstance();

        await current.dispose();
        await rejected;

        expect(runtime.realmCount).toBe(0);
        expect(runtime.pendingExecutions).toBe(0);
        expect(() => runtime.clock!.advance(300)).toThrow(/disposed/);
        expect(manager.has("probe")).toBe(false);
        expect(Object.getOwnPropertyDescriptor(globalThis, "chrome")).toEqual(previousChrome);

        const next = new BrowserTestSession();

        try {
            next.harness.configurable.chrome.i18n.getMessage.setResult("fr");
            expect(NativeLocale.getInstance()).not.toBe(locale);
            expect(NativeLocale.getInstance().lang()).toBe("fr");
            expect(Message.getInstance()).not.toBe(message);
            expect(RelayManager.getInstance()).not.toBe(manager);
        } finally {
            await next.dispose();
        }
    } finally {
        await current.dispose();
    }
});

test("continues teardown after a consumer cleanup fails and rejects pending message channels", async () => {
    const session = getBrowserTest();
    const receiver = session.harness.contexts.create({kind: "background"});
    const cleaned = jest.fn();

    receiver.onMessage.on(() => true);

    const pending = expect(sendMessage("probe")).rejects.toThrow();

    session.addCleanup(cleaned);
    session.addCleanup(() => {
        throw new Error("Consumer cleanup failed");
    });

    await expect(stopBrowserTest()).rejects.toThrow("Browser test cleanup failed");
    await pending;
    expect(cleaned).toHaveBeenCalledTimes(1);
    expect(session.harness.contexts.list()).toEqual([]);
});

test("keeps Firefox profile and runtime environment consistent and restores all environment values", async () => {
    const session = getBrowserTest();
    const original = [process.env.BROWSER, process.env.APP, process.env.MANIFEST_VERSION];
    const restore = session.useContext(session.context, "firefox");

    session.harness.runtime.getBrowserInfo.setResult({
        name: "Firefox",
        vendor: "Mozilla",
        version: "153.0",
        buildID: "test",
    });

    expect(isBrowser(Browser.Firefox)).toBe(true);
    await expect(getBrowserInfo()).resolves.toMatchObject({version: "153.0"});
    restore();
    expect(getBrowser()).toBe(Browser.Chrome);

    const nested = new BrowserTestSession({
        profile: "firefox",
        app: "fixture",
        manifest: {manifest_version: 2, name: "Fixture", version: "1.0.0"},
    });

    try {
        expect(getBrowser()).toBe(Browser.Firefox);
        expect(getApp()).toBe("fixture");
        expect(getManifestVersion()).toBe(2);
        process.env.APP = "changed-during-test";
        expect(getApp()).toBe("changed-during-test");
        process.env.MANIFEST_VERSION = "3";
        expect(getManifestVersion()).toBe(3);
    } finally {
        await nested.dispose();
    }

    expect([process.env.BROWSER, process.env.APP, process.env.MANIFEST_VERSION]).toEqual(original);
});

test("delivers runtime and tab messages through bound endpoints without advancing host fake timers", async () => {
    jest.useFakeTimers();

    const {harness} = getBrowserTest();

    harness.tabs.set([createTabFixture({id: 7})]);

    const worker = harness.contexts.create({kind: "background"});
    const content = harness.contexts.create({
        kind: "contentScript",
        tabId: 7,
        frameId: 0,
        url: "https://example.test/",
    });
    const endpoint = harness.messaging.forContext(worker);

    endpoint.chrome.runtime.onMessage.addListener((_message, _sender, reply) => {
        void Promise.resolve().then(() => reply("runtime response"));

        return true;
    });
    content.onMessage.on((_message, _sender, reply) => reply("tab response"));

    await expect(sendMessage("probe")).resolves.toBe("runtime response");
    await expect(sendTabMessage(7, "probe", {frameId: 0})).resolves.toBe("tab response");
    expect(jest.getTimerCount()).toBe(0);
    // Leave fake timers installed deliberately; shared teardown must restore them.
});

test("restores host timers before the next test", () => {
    expect(setTimeout).toBe(hostSetTimeout);
});

test("advances guest clocks independently of frozen host time", async () => {
    jest.useFakeTimers({now: 5000});

    const session = getBrowserTest();

    session.harness.tabs.set([createTabFixture({id: 7})]);
    session.harness.contexts.documents.create({documentId: "clock", tabId: 7, url: "https://example.test/"});

    const runtime = session.createScriptRuntime({clock: true});
    const pending = executeScript({
        target: {tabId: 7},
        func: () => new Promise(resolve => setTimeout(() => resolve(Date.now()), 300)),
    });

    runtime.clock!.advance(299);
    expect(runtime.pendingExecutions).toBe(1);
    runtime.clock!.advance(1);
    await expect(pending).resolves.toEqual([expect.objectContaining({result: 300})]);
    expect(Date.now()).toBe(5000);
    expect(jest.getTimerCount()).toBe(0);
});

test("keeps download-validation delay on the host clock", async () => {
    jest.useFakeTimers();

    const {harness} = getBrowserTest();
    let completed = false;
    const pending = harness.delays.downloadValidation.api(100).then(() => {
        completed = true;
    });

    await Promise.resolve();
    expect(completed).toBe(false);
    expect(jest.getTimerCount()).toBe(1);
    await jest.advanceTimersByTimeAsync(100);
    await pending;
    expect(completed).toBe(true);
});

test("resets all ObservableLocale caches, OffscreenBridge and cached Sandbox hosts", async () => {
    const driver = new MemoryLocaleStorage();
    const previous = [
        ObservableLocale.getInstance(),
        ObservableLocale.getInstance(false),
        ObservableLocale.getInstance(driver),
    ];
    const bridge = OffscreenBridge.getInstance();
    const host = SandboxMessage.for("probe", {url: "sandbox.html"});

    await getBrowserTest().dispose();

    const next = new BrowserTestSession();

    try {
        const current = [
            ObservableLocale.getInstance(),
            ObservableLocale.getInstance(false),
            ObservableLocale.getInstance(driver),
        ];

        current.forEach((instance, index) => expect(instance).not.toBe(previous[index]));
        expect(OffscreenBridge.getInstance()).not.toBe(bridge);
        expect(SandboxMessage.for("probe", {url: "sandbox.html"})).not.toBe(host);
    } finally {
        await next.dispose();
    }
});

test("reports an unknown framework global without skipping global and environment restoration", async () => {
    const unknownKey = "adnbnUnregisteredTestState";

    Reflect.set(globalThis, unknownKey, {});

    try {
        await expect(stopBrowserTest()).rejects.toThrow("Browser test cleanup failed");
        expect(Object.getOwnPropertyDescriptor(globalThis, "chrome")).toEqual(initialChrome);
        expect(process.env.BROWSER).toBe(initialBrowser);
    } finally {
        Reflect.deleteProperty(globalThis, unknownKey);
    }
});
