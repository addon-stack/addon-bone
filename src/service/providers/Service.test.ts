import {isBackground} from "@addon-core/browser";

import MessageManager from "@message/MessageManager";

import ProxyService from "./ProxyService";
import RegisterService from "./RegisterService";
import ServiceManager from "../ServiceManager";

import {DeepAsyncProxy} from "@typing/helpers";
import {MessageTypeSeparator} from "@typing/message";

jest.mock("@addon-core/browser", () => {
    const actual = jest.requireActual("@addon-core/browser");
    return {
        ...actual,
        isBackground: jest.fn(),
    };
});

beforeEach(async () => {
    jest.clearAllMocks();

    ServiceManager.getInstance().clear();
    MessageManager.getInstance().clear();

    new RegisterService(serviceName, () => MatchService).register();
});

const MatchService = {
    sum: (a: number, b: number): number => a + b,
    asyncSum: (a: number, b: number): Promise<number> => {
        return new Promise(resolve => setTimeout(() => resolve(a + b), 100));
    },
    one: 1,
    obj: {
        concat: (a: string, b: string): string => a + " " + b,
        zero: 0,
    },
};

type ServiceType = typeof MatchService;
type ServiceProxyType = DeepAsyncProxy<ServiceType>;

const serviceName = "math";

describe("ProxyService", () => {
    beforeEach(async () => {
        (isBackground as jest.Mock).mockReturnValue(false);
    });

    test("throws an error when get() is called in background context", async () => {
        (isBackground as jest.Mock).mockReturnValue(true);

        const proxy = new ProxyService(serviceName);

        expect(() => proxy.get()).toThrow(
            `You are trying to get proxy service "${serviceName}" from background. You can get original service instead`
        );
    });

    test("returns a proxy when not in background context", () => {
        const service = new ProxyService(serviceName).get();

        //@ts-ignore
        expect(service.__proxy).toBe(true);
    });

    test("invokes remote methods using Message.send", async () => {
        const service = new ProxyService<typeof serviceName, ServiceProxyType>(serviceName).get();

        expect(await service.sum(1, 2)).toBe(3);
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: `service${MessageTypeSeparator}${serviceName}`,
                data: {
                    path: "sum",
                    args: [1, 2],
                },
            }),
            expect.any(Function)
        );
    });

    test("accesses property on service object ", async () => {
        const service = new ProxyService<typeof serviceName, ServiceProxyType>(serviceName).get();

        expect(await service.one()).toBe(1);
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: `service${MessageTypeSeparator}${serviceName}`,
                data: {
                    path: "one",
                    args: [],
                },
            }),
            expect.any(Function)
        );
    });

    test("accesses nested method or property ", async () => {
        const service = new ProxyService<typeof serviceName, ServiceProxyType>(serviceName).get();

        expect(await service.obj.concat("Hello", "world")).toBe("Hello world");
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: `service${MessageTypeSeparator}${serviceName}`,
                data: {
                    path: "obj.concat",
                    args: ["Hello", "world"],
                },
            }),
            expect.any(Function)
        );

        expect(await service.obj.zero()).toBe(0);
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: `service${MessageTypeSeparator}${serviceName}`,
                data: {
                    path: "obj.zero",
                    args: [],
                },
            }),
            expect.any(Function)
        );
    });

    test("handles proxied async methods that return promises", async () => {
        const service = new ProxyService<typeof serviceName, ServiceProxyType>(serviceName).get();

        expect(await service.asyncSum(1, 2)).toBe(3);
    });
});

describe("RegisterService", () => {
    beforeEach(async () => {
        (isBackground as jest.Mock).mockReturnValue(true);
    });

    test("throws an error when get() is called outside background context", async () => {
        (isBackground as jest.Mock).mockReturnValue(false);

        const proxy = new RegisterService(serviceName, () => MatchService);

        expect(() => proxy.get()).toThrow(`Service "${serviceName}" can be getting only from background context.`);
    });

    test("returns real service when called in background context", () => {
        const service = new RegisterService<typeof serviceName, ServiceType>(serviceName, () => MatchService).get();

        //@ts-ignore
        expect(service.__proxy).toBe(undefined);
    });

    test("invokes methods directly without using Message.send in background", async () => {
        const service = new RegisterService<typeof serviceName, ServiceType>(serviceName, () => MatchService).get();

        expect(service.sum(1, 2)).toBe(3);
        expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(0);
    });

    test("throws an error when attempting to register the same service twice", async () => {
        const service = new RegisterService<typeof serviceName, ServiceType>(serviceName, () => MatchService);

        expect(() => service.register()).toThrow(
            `A instance with name "${serviceName}" already exists. The name must be unique.`
        );
    });
});
