/** @jest-environment node */

jest.unmock("@addon-core/browser");

import {getService} from "@main/service";

import ProxyService from "./ProxyService";

import {MessageResultEnvelopeProperty, MessageTypeSeparator} from "@typing/message";

type ServiceProxy = {
    someMethod(value: string): Promise<string>;
};

type RuntimeSendMessage = (message: unknown, callback: (response: unknown) => void) => void;

const serviceName = "test";

const setRuntime = (runtime?: {sendMessage?: RuntimeSendMessage; getManifest?: () => chrome.runtime.Manifest}) => {
    Object.defineProperty(globalThis, "chrome", {
        configurable: true,
        writable: true,
        value: runtime
            ? {
                  runtime: {
                      id: "extension-id",
                      ...runtime,
                  },
              }
            : undefined,
    });
};

const setExtensionDocument = (pathname: string) => {
    Object.defineProperty(globalThis, "window", {configurable: true, value: {}});
    Object.defineProperty(globalThis, "location", {configurable: true, value: {pathname}});
};

const getTestService = (): ServiceProxy => getService(serviceName as never) as ServiceProxy;

describe("ProxyService context detection", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test("creates a service proxy in an offscreen-like context with no runtime.getManifest", async () => {
        const expectedResult = "background:value";
        const sendMessage = jest.fn<ReturnType<RuntimeSendMessage>, Parameters<RuntimeSendMessage>>(
            (_message, callback) => {
                callback({[MessageResultEnvelopeProperty]: true, ok: true, payload: expectedResult});
            }
        );

        setRuntime({sendMessage});
        setExtensionDocument("/offscreen.html");

        expect(() => getTestService()).not.toThrow();

        const service = getTestService();

        // @ts-expect-error - The runtime proxy marker is intentionally hidden from its public type.
        expect(service.__proxy).toBe(true);
        await expect(service.someMethod("value")).resolves.toBe(expectedResult);
        expect(sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: `service${MessageTypeSeparator}${serviceName}`,
                data: {
                    path: "someMethod",
                    args: ["value"],
                },
            }),
            expect.any(Function)
        );
    });

    test("restores serialized background errors in an offscreen-like context", async () => {
        const sendMessage = jest.fn<ReturnType<RuntimeSendMessage>, Parameters<RuntimeSendMessage>>(
            (_message, callback) => {
                callback({
                    [MessageResultEnvelopeProperty]: true,
                    ok: false,
                    error: {name: "TypeError", message: "background failed"},
                });
            }
        );

        setRuntime({sendMessage});
        setExtensionDocument("/offscreen.html");

        await expect(getTestService().someMethod("value")).rejects.toThrow("background failed");
        await expect(getTestService().someMethod("value")).rejects.toBeInstanceOf(TypeError);
    });

    test.each([
        ["popup", "/popup.html"],
        ["sidebar", "/sidebar.html"],
        ["content script", "/content-script.html"],
    ])("creates a proxy in %s context", (_context, pathname) => {
        setRuntime({
            getManifest: () =>
                ({manifest_version: 3, background: {service_worker: "background.js"}}) as chrome.runtime.Manifest,
        });
        setExtensionDocument(pathname);

        expect(() => getTestService()).not.toThrow();
    });

    test("creates a proxy when the WebExtension API is unavailable", () => {
        setRuntime();
        setExtensionDocument("/standalone.html");

        expect(() => getTestService()).not.toThrow();
    });

    test("continues to reject service proxies in an MV3 service worker", () => {
        setRuntime({
            getManifest: () =>
                ({manifest_version: 3, background: {service_worker: "background.js"}}) as chrome.runtime.Manifest,
        });
        Object.defineProperty(globalThis, "window", {configurable: true, value: undefined});

        expect(() => new ProxyService(serviceName).get()).toThrow(
            `You are trying to get proxy service "${serviceName}" from background. You can get original service instead`
        );
    });
});
