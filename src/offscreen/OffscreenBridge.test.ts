import {isBackground} from "@addon-core/browser";

import {Message} from "@message/providers";

import OffscreenBridge from "./OffscreenBridge";

import {OffscreenBridgeReadyMessageType} from "@typing/offscreen";

const mockedIsBackground = isBackground as jest.MockedFunction<typeof isBackground>;

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
        jest.clearAllMocks();
        jest.restoreAllMocks();

        document.body.innerHTML = "";
        mockedIsBackground.mockReturnValue(true);

        (OffscreenBridge as any).instance = undefined;
    });

    afterEach(() => {
        jest.useRealTimers();
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

    test("sends creation request through message outside background context", async () => {
        mockedIsBackground.mockReturnValue(false);

        const send = jest.spyOn(Message.prototype, "send").mockResolvedValue(undefined);
        const bridge = new OffscreenBridge();

        await expect(bridge.create(parameters)).resolves.toBeUndefined();

        expect(send).toHaveBeenCalledWith("offscreen-background", parameters);
        expect(document.querySelector("iframe")).toBeNull();
    });

    test("uses a singleton instance for static createOffscreen", async () => {
        const create = jest.spyOn(OffscreenBridge.prototype, "create").mockResolvedValue(undefined);

        await OffscreenBridge.createOffscreen(parameters);
        await OffscreenBridge.createOffscreen(parameters);

        expect(create).toHaveBeenCalledTimes(2);
        expect(create.mock.instances[0]).toBe(create.mock.instances[1]);
        expect(create).toHaveBeenNthCalledWith(1, parameters);
        expect(create).toHaveBeenNthCalledWith(2, parameters);
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
