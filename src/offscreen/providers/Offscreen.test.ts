import {closeOffscreen, createOffscreen, hasOffscreen} from "@addon-core/browser";
import {isOffscreen} from "@offscreen/utils";

import {getBrowser} from "@main/env";

import MessageManager from "@message/MessageManager";

import ProxyOffscreen from "./ProxyOffscreen";
import RegisterOffscreen from "./RegisterOffscreen";
import OffscreenManager from "../OffscreenManager";

import {DeepAsyncProxy} from "@typing/helpers";
import {MessageTypeSeparator} from "@typing/message";
import {Browser} from "@typing/browser";

jest.mock("@offscreen/utils", () => ({isOffscreen: jest.fn()}));
jest.mock("@main/env", () => ({getBrowser: jest.fn()}));

beforeEach(async () => {
    jest.clearAllMocks();

    OffscreenManager.getInstance().clear();
    MessageManager.getInstance().clear();

    new RegisterOffscreen(offscreenName, () => MatchService).register();
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

type OffscreenType = typeof MatchService;
type OffscreenProxyType = DeepAsyncProxy<OffscreenType>;

const offscreenName = "math";
const parameters = {
    reasons: ["TESTING" as const],
    url: "offscreen.html",
    justification: "for testing",
};

describe("ProxyOffscreen", () => {
    beforeEach(async () => {
        (isOffscreen as jest.Mock).mockReturnValue(false);
        (hasOffscreen as jest.Mock).mockReturnValue(true);
        (getBrowser as jest.Mock).mockReturnValue(Browser.Chrome);
    });

    test("throws an error when get() is called in offscreen context", async () => {
        (isOffscreen as jest.Mock).mockReturnValue(true);

        const proxy = new ProxyOffscreen(offscreenName, parameters);

        expect(() => proxy.get()).toThrow(
            `You are trying to get proxy offscreen service "${offscreenName}" from offscreen. You can get original offscreen service instead`
        );
    });

    test("returns a proxy when not in offscreen context", () => {
        const offscreen = new ProxyOffscreen(offscreenName, parameters).get();

        //@ts-ignore
        expect(offscreen.__proxy).toBe(true);
    });

    test("invokes remote methods using Message.send", async () => {
        const offscreen = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters).get();

        expect(await offscreen.sum(1, 2)).toBe(3);
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: `offscreen${MessageTypeSeparator}${offscreenName}`,
                data: {
                    path: "sum",
                    args: [1, 2],
                },
            }),
            expect.any(Function)
        );
    });

    test("accesses property on offscreen service object ", async () => {
        const offscreen = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters).get();

        expect(await offscreen.one()).toBe(1);
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: `offscreen${MessageTypeSeparator}${offscreenName}`,
                data: {
                    path: "one",
                    args: [],
                },
            }),
            expect.any(Function)
        );
    });

    test("accesses nested method or property ", async () => {
        const offscreen = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters).get();

        expect(await offscreen.obj.concat("Hello", "world")).toBe("Hello world");
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: `offscreen${MessageTypeSeparator}${offscreenName}`,
                data: {
                    path: "obj.concat",
                    args: ["Hello", "world"],
                },
            }),
            expect.any(Function)
        );

        expect(await offscreen.obj.zero()).toBe(0);
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: `offscreen${MessageTypeSeparator}${offscreenName}`,
                data: {
                    path: "obj.zero",
                    args: [],
                },
            }),
            expect.any(Function)
        );
    });

    test("handles proxied async methods that return promises", async () => {
        const offscreen = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters).get();

        expect(await offscreen.asyncSum(1, 2)).toBe(3);
    });

    test("does not recreate offscreen when URL hasn't changed", async () => {
        jest.clearAllMocks();
        (hasOffscreen as jest.Mock).mockReturnValue(false);

        const proxyInstance = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters);
        const offscreen = proxyInstance.get();

        await offscreen.sum(1, 2);

        (hasOffscreen as jest.Mock).mockReturnValue(true);
        await offscreen.sum(3, 4);

        expect(createOffscreen).toHaveBeenCalledTimes(1);
        expect(closeOffscreen).toHaveBeenCalledTimes(0);
    });

    test("recreates offscreen when URL changes", async () => {
        jest.clearAllMocks();
        (hasOffscreen as jest.Mock).mockReturnValue(false);

        const proxyInstance1 = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters);
        const offscreen1 = proxyInstance1.get();
        await offscreen1.sum(1, 2);

        (hasOffscreen as jest.Mock).mockReturnValue(true);
        const differentParams = {...parameters, url: "different-offscreen.html"};
        const proxyInstance2 = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(
            offscreenName,
            differentParams
        );
        const offscreen2 = proxyInstance2.get();
        await offscreen2.sum(3, 4);

        expect(createOffscreen).toHaveBeenCalledTimes(2);
        expect(closeOffscreen).toHaveBeenCalledTimes(1);
    });
});

describe("RegisterOffscreen", () => {
    beforeEach(async () => {
        (isOffscreen as jest.Mock).mockReturnValue(true);
    });

    test("throws an error when get() is called outside offscreen context", async () => {
        (isOffscreen as jest.Mock).mockReturnValue(false);

        const proxy = new RegisterOffscreen(offscreenName, () => MatchService);

        expect(() => proxy.get()).toThrow(
            `Offscreen service "${offscreenName}" can be getting only from offscreen context.`
        );
    });

    test("returns real offscreen service when called in offscreen context", () => {
        const offscreen = new RegisterOffscreen<typeof offscreenName, OffscreenType>(
            offscreenName,
            () => MatchService
        ).get();

        //@ts-ignore
        expect(offscreen.__proxy).toBe(undefined);
    });

    test("invokes methods directly without using Message.send in offscreen", async () => {
        const offscreen = new RegisterOffscreen<typeof offscreenName, OffscreenType>(
            offscreenName,
            () => MatchService
        ).get();

        expect(offscreen.sum(1, 2)).toBe(3);
        expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(0);
    });

    test("throws an error when attempting to register the same offscreen service twice", async () => {
        const offscreen = new RegisterOffscreen<typeof offscreenName, OffscreenType>(offscreenName, () => MatchService);

        expect(() => offscreen.register()).toThrow(
            `A instance with name "${offscreenName}" already exists. The name must be unique.`
        );
    });
});
