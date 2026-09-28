import {getBrowserTest} from "@tests/browser-harness/session";
import {OffscreenBackground, ProxyOffscreen, RegisterOffscreen} from "./index";
import type {RpcAsyncProxy} from "@typing/rpc";

import OffscreenBridge from "./OffscreenBridge";

import {OffscreenBridgeReadyMessageType} from "@typing/offscreen";

const parameters = {
    reasons: ["TESTING" as const],
    url: "offscreen.html",
    justification: "for testing",
};

const wait = () => new Promise(resolve => setTimeout(resolve));
const dispatchReady = (iframe: HTMLIFrameElement) => {
    window.dispatchEvent(
        new MessageEvent("message", {
            data: {type: OffscreenBridgeReadyMessageType},
            origin: location.origin,
            source: iframe.contentWindow,
        })
    );
};

describe("OffscreenBridge", () => {
    beforeEach(() => {
        const session = getBrowserTest();
        const originalUrl = location.href;
        const background = session.harness.contexts.create({kind: "background"});

        session.harness.runtime.setManifest({
            name: "Offscreen test",
            version: "1.0.0",
            manifest_version: 2,
            background: {scripts: ["background.js"]},
        });
        process.env.MANIFEST_VERSION = "2";
        session.useContext(background, "firefox");
        history.replaceState(null, "", "/_generated_background_page.html");
        document.body.replaceChildren();
        session.addCleanup(() => {
            document.body.replaceChildren();
            history.replaceState(null, "", originalUrl);
        });
    });

    test("creates an iframe in background context", async () => {
        const bridge = new OffscreenBridge();
        const creation = bridge.create(parameters);
        const iframe = document.querySelector("iframe");

        expect(iframe).not.toBeNull();
        expect(iframe?.getAttribute("src")).toBe(parameters.url);

        dispatchReady(iframe!);

        await expect(creation).resolves.toBeUndefined();
    });

    test("waits for ready message instead of iframe load", async () => {
        const bridge = new OffscreenBridge();
        const creation = bridge.create(parameters);
        const iframe = document.querySelector("iframe");
        let resolved = false;

        creation.then(() => {
            resolved = true;
        });

        iframe!.dispatchEvent(new Event("load"));
        await wait();

        expect(resolved).toBe(false);

        dispatchReady(iframe!);

        await expect(creation).resolves.toBeUndefined();
        expect(resolved).toBe(true);
    });

    test("sends creation request through real messaging outside background context", async () => {
        jest.useFakeTimers();

        const session = getBrowserTest();

        new OffscreenBackground().build();
        session.useContext(session.context);
        history.replaceState(null, "", "/popup.html");

        const creation = new OffscreenBridge().create(parameters);

        await jest.advanceTimersByTimeAsync(0);

        const iframe = document.querySelector("iframe");

        expect(iframe?.getAttribute("src")).toBe(parameters.url);
        dispatchReady(iframe!);

        await expect(creation).resolves.toBeUndefined();
        expect(session.harness.messaging.forContext(session.context).runtime.sendMessage.calls[0].args).toEqual([
            expect.objectContaining({type: "offscreen-background", data: parameters}),
        ]);
    });

    test("propagates a failed creation response from the background context", async () => {
        const session = getBrowserTest();

        new OffscreenBackground().build();
        session.useContext(session.context);
        history.replaceState(null, "", "/popup.html");

        const creation = new OffscreenBridge().create(parameters);
        const rejection = expect(creation).rejects.toThrow(`Offscreen iframe failed to load: ${parameters.url}`);

        await wait();
        document.querySelector("iframe")!.dispatchEvent(new Event("error"));

        await rejection;
        expect(document.querySelector("iframe")).toBeNull();
    });

    test("uses a singleton instance and shares pending static creation", async () => {
        const bridge = OffscreenBridge.getInstance();
        const first = OffscreenBridge.createOffscreen(parameters);
        const second = OffscreenBridge.createOffscreen(parameters);
        const iframe = document.querySelector("iframe");

        expect(OffscreenBridge.getInstance()).toBe(bridge);
        expect(document.querySelectorAll("iframe")).toHaveLength(1);
        dispatchReady(iframe!);

        await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
        await OffscreenBridge.createOffscreen(parameters);
        expect(document.querySelector("iframe")).toBe(iframe);
    });

    test("waits for an in-flight iframe creation when the same URL is requested again", async () => {
        const bridge = new OffscreenBridge();
        const first = bridge.create(parameters);
        const second = bridge.create(parameters);

        const iframe = document.querySelector("iframe");
        let secondResolved = false;

        second.then(() => {
            secondResolved = true;
        });

        await wait();

        expect(document.querySelectorAll("iframe")).toHaveLength(1);
        expect(iframe).not.toBeNull();
        expect(secondResolved).toBe(false);

        dispatchReady(iframe!);

        await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
        expect(secondResolved).toBe(true);
    });

    test("creates independent iframes for different URLs", async () => {
        const bridge = new OffscreenBridge();
        const otherParameters = {...parameters, url: "other-offscreen.html"};

        const first = bridge.create(parameters);
        const second = bridge.create(otherParameters);
        const frames = document.querySelectorAll("iframe");

        expect(frames).toHaveLength(2);
        expect(frames[0].getAttribute("src")).toBe(parameters.url);
        expect(frames[1].getAttribute("src")).toBe(otherParameters.url);

        dispatchReady(frames[0]);
        dispatchReady(frames[1]);

        await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    });

    test("reuses an already ready iframe for the same URL", async () => {
        const bridge = new OffscreenBridge();

        const first = bridge.create(parameters);
        const iframe = document.querySelector("iframe");

        dispatchReady(iframe!);

        await first;
        await expect(bridge.create(parameters)).resolves.toBeUndefined();

        expect(document.querySelectorAll("iframe")).toHaveLength(1);
    });

    test("rejects and removes the iframe when creation fails", async () => {
        const bridge = new OffscreenBridge();

        const first = bridge.create(parameters);
        const iframe = document.querySelector("iframe");

        iframe!.dispatchEvent(new Event("error"));

        await expect(first).rejects.toThrow(`Offscreen iframe failed to load: ${parameters.url}`);
        expect(document.querySelector("iframe")).toBeNull();

        const second = bridge.create(parameters);
        const nextIframe = document.querySelector("iframe");

        expect(nextIframe).not.toBeNull();
        expect(nextIframe).not.toBe(iframe);

        dispatchReady(nextIframe!);

        await expect(second).resolves.toBeUndefined();
    });

    test.each(["source", "origin", "type"] as const)("ignores a ready message with the wrong %s", async field => {
        const bridge = new OffscreenBridge();
        const creation = bridge.create(parameters);
        const iframe = document.querySelector("iframe")!;
        let resolved = false;

        creation.then(() => {
            resolved = true;
        });

        window.dispatchEvent(
            new MessageEvent("message", {
                data: {type: field === "type" ? "unrelated" : OffscreenBridgeReadyMessageType},
                origin: field === "origin" ? "https://other.test" : location.origin,
                source: field === "source" ? window : iframe.contentWindow,
            })
        );

        await wait();
        expect(resolved).toBe(false);
        dispatchReady(iframe);

        await expect(creation).resolves.toBeUndefined();
    });

    test("removes the iframe when ready message times out", async () => {
        jest.useFakeTimers();

        const bridge = new OffscreenBridge();

        const first = bridge.create(parameters);
        const iframe = document.querySelector("iframe");
        const rejection = expect(first).rejects.toThrow(`Offscreen iframe "${parameters.url}" was not ready in time.`);

        jest.runOnlyPendingTimers();

        await rejection;
        expect(document.querySelector("iframe")).toBeNull();

        const second = bridge.create(parameters);
        const nextIframe = document.querySelector("iframe");

        expect(nextIframe).not.toBeNull();
        expect(nextIframe).not.toBe(iframe);

        dispatchReady(nextIframe!);

        await expect(second).resolves.toBeUndefined();
    });
});

test.each([
    {profile: "firefox" as const, version: 2 as const},
    {profile: "firefox" as const, version: 3 as const},
    {profile: "chrome" as const, version: 2 as const},
])("ProxyOffscreen waits for iframe readiness on $profile MV$version", async ({profile, version}) => {
    const session = getBrowserTest();
    const originalUrl = location.href;
    const background = session.harness.contexts.create({kind: "background"});
    const frameContext = session.harness.contexts.create({kind: "extensionPage"});
    const service = {sum: (a: number, b: number) => a + b};

    const manifest = {
        name: "Offscreen test",
        version: "1.0.0",
        background: {scripts: ["background.js"]},
    };

    // Firefox MV3 uses background.scripts; the kit accepts manifests through Chrome's narrower type.
    session.harness.runtime.setManifest({...manifest, manifest_version: version} as chrome.runtime.Manifest);
    process.env.MANIFEST_VERSION = String(version);
    session.useContext(background, profile);
    history.replaceState(null, "", "/_generated_background_page.html");
    session.addCleanup(() => {
        document.body.replaceChildren();
        history.replaceState(null, "", originalUrl);
    });

    const restore = session.useContext(frameContext);
    const registration = new RegisterOffscreen("math", () => service);

    registration.register();
    session.addCleanup(() => registration.destroy());
    restore();

    const proxy = new ProxyOffscreen<"math", RpcAsyncProxy<typeof service>>("math", parameters).get();
    const result = proxy.sum(1, 2);
    const iframe = document.querySelector("iframe");
    const caller = session.harness.messaging.forContext(background);

    expect(iframe).not.toBeNull();
    expect(caller.runtime.sendMessage.calls).toHaveLength(0);
    dispatchReady(iframe!);

    await expect(result).resolves.toBe(3);
    expect(caller.runtime.sendMessage.calls).toHaveLength(1);
    expect(session.harness.offscreen.createDocument.calls).toHaveLength(0);
});
