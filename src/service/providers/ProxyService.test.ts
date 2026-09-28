import {
    createManifestFixture,
    createTabFixture,
    installGlobals,
    type BrowserContext,
} from "@addon-core/browser/testing";
import {getService} from "@main/service";
import {getBrowserTest} from "@tests/browser-harness/session";
import {ProxyService, RegisterService} from "./index";
import {mathService, serviceName, type MathService} from "./tests/fixtures/math-service";
import type {RpcAsyncProxy} from "@typing/rpc";
import {MessageTypeSeparator} from "@typing/message";

type ServiceProxy = RpcAsyncProxy<MathService>;

let background: BrowserContext;

const getTestService = (): ServiceProxy => getService(serviceName as never) as ServiceProxy;
const sender = () => getBrowserTest().harness.messaging.forContext(getBrowserTest().context);

beforeEach(() => {
    const session = getBrowserTest();
    background = session.harness.contexts.create({kind: "background"});

    session.harness.runtime.setManifest(
        createManifestFixture({manifest_version: 3, background: {service_worker: "background.js"}})
    );
    session.addCleanup(installGlobals({window: undefined}));

    const restore = session.useContext(background);
    const registration = new RegisterService(serviceName, () => mathService);

    registration.register();
    session.addCleanup(() => registration.destroy());
    restore();
    session.addCleanup(installGlobals({window: {}, location: {pathname: "/popup.html"}}));
});

describe("ProxyService", () => {
    test("rejects proxies in an MV3 background service worker", () => {
        const session = getBrowserTest();

        session.useContext(background);
        session.addCleanup(installGlobals({window: undefined}));

        expect(() => new ProxyService(serviceName).get()).toThrow(
            `You are trying to get proxy service "${serviceName}" from background. You can get original service instead`
        );
    });

    test("returns a proxy outside background", () => {
        expect(Reflect.get(getTestService(), "__proxy")).toBe(true);
    });

    test("rejects proxies in an MV2 generated background page", () => {
        const session = getBrowserTest();

        session.harness.runtime.setManifest(
            createManifestFixture({manifest_version: 2, background: {scripts: ["background.js"]}})
        );
        session.useContext(background);
        session.addCleanup(installGlobals({window: {}, location: {pathname: "/_generated_background_page.html"}}));

        expect(() => getTestService()).toThrow(
            `You are trying to get proxy service "${serviceName}" from background. You can get original service instead`
        );
    });

    test("invokes a real background method through runtime messaging", async () => {
        await expect(getTestService().sum(1, 2)).resolves.toBe(3);
        expect(sender().runtime.sendMessage.calls.at(-1)?.args).toEqual([
            expect.objectContaining({
                type: `service${MessageTypeSeparator}${serviceName}`,
                data: {path: "sum", args: [1, 2]},
            }),
        ]);
    });

    test("reads a service property", async () => {
        await expect(getTestService().one()).resolves.toBe(1);
        expect(sender().runtime.sendMessage.calls.at(-1)?.args).toEqual([
            expect.objectContaining({data: {path: "one", args: []}}),
        ]);
    });

    test("accesses nested methods and falsy properties", async () => {
        const service = getTestService();

        await expect(service.obj.concat("Hello", "world")).resolves.toBe("Hello world");
        expect(sender().runtime.sendMessage.calls.at(-1)?.args).toEqual([
            expect.objectContaining({data: {path: "obj.concat", args: ["Hello", "world"]}}),
        ]);
        await expect(service.obj.zero()).resolves.toBe(0);
        expect(sender().runtime.sendMessage.calls.at(-1)?.args).toEqual([
            expect.objectContaining({data: {path: "obj.zero", args: []}}),
        ]);
    });

    test("awaits asynchronous background methods", async () => {
        jest.useFakeTimers();

        const result = getTestService().asyncSum(1, 2);

        await jest.advanceTimersByTimeAsync(100);
        await expect(result).resolves.toBe(3);
    });

    test("calls background from an offscreen context without runtime.getManifest", async () => {
        const session = getBrowserTest();
        const offscreen = session.harness.contexts.create({kind: "offscreen"});

        session.harness.capabilities.set("runtime.getManifest", false);
        session.useContext(offscreen);
        session.addCleanup(installGlobals({location: {pathname: "/offscreen.html"}}));

        expect(chrome.runtime.getManifest).toBeUndefined();
        expect(Reflect.get(getTestService(), "__proxy")).toBe(true);
        await expect(getTestService().sum(1, 2)).resolves.toBe(3);
        expect(session.harness.messaging.forContext(offscreen).runtime.sendMessage.calls).toHaveLength(1);
    });

    test("restores real background errors in an offscreen context", async () => {
        const session = getBrowserTest();
        const offscreen = session.harness.contexts.create({kind: "offscreen"});

        jest.spyOn(console, "error").mockImplementation(() => {});

        session.harness.capabilities.set("runtime.getManifest", false);
        session.useContext(offscreen);
        session.addCleanup(installGlobals({location: {pathname: "/offscreen.html"}}));

        await expect(getTestService().fail()).rejects.toThrow("background failed");
        await expect(getTestService().fail()).rejects.toBeInstanceOf(TypeError);
    });

    test.each([
        ["popup", "/popup.html"],
        ["sidebar", "/sidebar.html"],
        ["content script", "/content-script.html"],
    ])("calls background from %s", async (name, pathname) => {
        const session = getBrowserTest();
        session.harness.tabs.set([createTabFixture({id: 1, url: "https://example.com"})]);

        const context = session.harness.contexts.create(
            name === "content script"
                ? {kind: "contentScript", tabId: 1, frameId: 0, url: "https://example.com"}
                : {kind: "extensionPage", url: chrome.runtime.getURL(pathname.slice(1))}
        );

        session.useContext(context);
        session.addCleanup(installGlobals({location: {pathname}}));

        await expect(getTestService().sum(1, 2)).resolves.toBe(3);
        expect(session.harness.messaging.forContext(context).runtime.sendMessage.calls).toHaveLength(1);
    });

    test("creates a proxy when WebExtension APIs are unavailable", () => {
        getBrowserTest().addCleanup(installGlobals({chrome: undefined, browser: undefined}));

        expect(() => getTestService()).not.toThrow();
    });

    test("propagates a transport failure and allows a later call", async () => {
        const service = getTestService();

        sender().runtime.sendMessage.failNext(new Error("Channel closed"));

        await expect(service.sum(1, 2)).rejects.toThrow("Channel closed");
        await expect(service.sum(3, 4)).resolves.toBe(7);
    });
});
