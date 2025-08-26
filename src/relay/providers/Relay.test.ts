import {isAvailableScripting} from "@adnbn/browser";

import ProxyRelay from "./ProxyRelay";
import RegisterRelay from "./RegisterRelay";
import RelayManager from "../RelayManager";

import {RelayGlobalKey, RelayMethod} from "@typing/relay";
import {DeepAsyncProxy} from "@typing/helpers";

beforeEach(async () => {
    jest.clearAllMocks();

    RelayManager.getInstance().clear();

    new RegisterRelay(relayName, RelayMethod.Scripting, () => MatchRelay).register();
});

const MatchRelay = {
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

type RelayType = typeof MatchRelay;
type RelayProxyType = DeepAsyncProxy<RelayType>;

const relayName = "math";

describe("ProxyRelay", () => {
    beforeEach(async () => {
        (isAvailableScripting as jest.Mock).mockReturnValue(true);
    });

    test("throws an error when get() is called in content script context", async () => {
        (isAvailableScripting as jest.Mock).mockReturnValue(false);

        const proxy = new ProxyRelay(relayName, RelayMethod.Scripting, 1);

        expect(() => proxy.get()).toThrow(
            `You are trying to get proxy relay "${relayName}" from script content. You can get original relay instead`
        );
    });

    test("returns a proxy when called not in content script context", () => {
        const relay = new ProxyRelay(relayName, RelayMethod.Scripting, 1).get();

        expect(relay["__proxy"]).toBe(true);
    });

    test("invokes remote methods using chrome.scripting", async () => {
        const relay = new ProxyRelay<typeof relayName, RelayProxyType>(relayName, RelayMethod.Scripting, 1).get();

        expect(await relay.sum(1, 2)).toBe(3);

        expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);

        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
            expect.objectContaining({
                target: {tabId: 1},
                func: expect.any(Function),
                args: [relayName, "sum", [1, 2], RelayGlobalKey],
            })
        );
    });

    test("accesses primitive value as method on the relay object", async () => {
        const relay = new ProxyRelay<typeof relayName, RelayProxyType>(relayName, RelayMethod.Scripting, {tabId: 1, frameId: 2}).get();

        expect(await relay.one()).toBe(1);
        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
            expect.objectContaining({
                target: {tabId: 1, frameIds: [2]},
                func: expect.any(Function),
                args: [relayName, "one", [], RelayGlobalKey],
            })
        );
    });

    test("accesses nested method or property ", async () => {
        const relay = new ProxyRelay<typeof relayName, RelayProxyType>(relayName, RelayMethod.Scripting, 1).get();

        expect(await relay.obj.concat("Hello", "world")).toBe("Hello world");
        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
            expect.objectContaining({
                target: {tabId: 1},
                func: expect.any(Function),
                args: [relayName, "obj.concat", ["Hello", "world"], RelayGlobalKey],
            })
        );

        expect(await relay.obj.zero()).toBe(0);
        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(
            expect.objectContaining({
                target: {tabId: 1},
                func: expect.any(Function),
                args: [relayName, "obj.zero", [], RelayGlobalKey],
            })
        );
    });

    test("calls async method on proxy and returns resolved value", async () => {
        const relay = new ProxyRelay<typeof relayName, RelayProxyType>(relayName, RelayMethod.Scripting, 1).get();

        expect(await relay.asyncSum(1, 2)).toBe(3);
    });

    test("uses scriptingApply method when RelayMethod is 'scripting'", async () => {
        const proxy = new ProxyRelay(relayName, RelayMethod.Scripting, 1);
        const relay = proxy.get();
        const scriptingApplySpy = jest.spyOn(proxy as any, 'scriptingApply');
        scriptingApplySpy.mockResolvedValue('scripting result');

        const result = await relay.sum(1, 2);

        expect(scriptingApplySpy).toHaveBeenCalledWith([1, 2], 'sum');
        expect(result).toBe('scripting result');

        scriptingApplySpy.mockRestore();
    });

    test("uses messagingApply method when RelayMethod is 'messaging'", async () => {
        const proxy = new ProxyRelay(relayName, RelayMethod.Messaging, 1);
        const relay = proxy.get();
        const messagingApplySpy = jest.spyOn(proxy as any, 'messagingApply');
        messagingApplySpy.mockResolvedValue('messaging result');

        const result = await relay.sum(1, 2);

        expect(messagingApplySpy).toHaveBeenCalledWith([1, 2], 'sum');
        expect(result).toBe('messaging result');

        messagingApplySpy.mockRestore();
    });

});

describe("RegisterRelay", () => {
    beforeEach(async () => {
        (isAvailableScripting as jest.Mock).mockReturnValue(false);
    });

    test("throws if trying to get registered relay from non-content script", async () => {
        (isAvailableScripting as jest.Mock).mockReturnValue(true);

        const proxy = new RegisterRelay(relayName, RelayMethod.Scripting, () => MatchRelay);

        expect(() => proxy.get()).toThrow(`Relay "${relayName}" can be getting only from content script`);
    });

    test("returns real relay when called in content script context", () => {
        const relay = new RegisterRelay<typeof relayName, RelayType>(relayName, RelayMethod.Scripting, () => MatchRelay).get();

        expect(relay["__proxy"]).toBe(undefined);
    });

    test("calls method directly in content script without chrome.scripting", async () => {
        const relay = new RegisterRelay<typeof relayName, RelayType>(relayName, RelayMethod.Scripting, () => MatchRelay).get();

        expect(relay.sum(1, 2)).toBe(3);
        expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(0);
    });

    test("throws an error when attempting to register the same relay twice", async () => {
        const relay = new RegisterRelay<typeof relayName, RelayType>(relayName, RelayMethod.Scripting, () => MatchRelay);

        expect(() => relay.register()).toThrow(
            `A relay with the name "${relayName}" already exists. The relay name must be unique.`
        );
    });

    test("does not call parent register method when RelayMethod is 'scripting'", () => {
        const registerRelay = new RegisterRelay(relayName, RelayMethod.Scripting, () => MatchRelay);
        const parentRegisterSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(registerRelay)), 'register');
        jest.spyOn(RelayManager.getInstance(), 'has').mockReturnValue(false);

        registerRelay.register();

        expect(parentRegisterSpy).not.toHaveBeenCalled();

        parentRegisterSpy.mockRestore();
    });

    test("calls parent register method when method is 'messaging'", () => {
        const registerRelay = new RegisterRelay(relayName, RelayMethod.Messaging, () => MatchRelay);
        const parentRegisterSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(registerRelay)), 'register');
        parentRegisterSpy.mockReturnValue(MatchRelay);

        const result = registerRelay.register();

        expect(result).toBe(MatchRelay);
        expect(parentRegisterSpy).toHaveBeenCalledWith();

        parentRegisterSpy.mockRestore();
    });
});
