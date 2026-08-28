import Message from "./Message";
import {getBrowserInfo} from "@addon-core/browser";
import * as env from "@main/env";

import {isRemoteMessageError, UnsupportedMessageTargetError} from "../error";

type MessageMap = {
    getStringLength: (data: string) => number;
    toUpperCase: (str: string) => string;
    sayHello: (data?: string) => string;
    fetchUser: (name: string) => Promise<{name: string}>;
    throwSync: (message: string) => never;
    throwAsync: (message: string) => Promise<void>;
    throwPrimitive: (message: string) => never;
    throwPlainObject: (message: string) => never;
    envelopeLikePayload: (data?: undefined) => {ok: false; error: string};
    rawEnvelopeLikePayload: (data?: undefined) => {ok: false; error: string};
    rawSuccessEnvelopeLikePayload: (data?: undefined) => {ok: true; payload: string};
};

let message: Message<MessageMap>;
const mockedEnv = env as jest.Mocked<typeof env>;
const mockedGetBrowserInfo = getBrowserInfo as jest.MockedFunction<typeof getBrowserInfo>;

beforeEach(async () => {
    jest.clearAllMocks();
    mockedEnv.isBrowser.mockReturnValue(false);
    mockedGetBrowserInfo.mockResolvedValue({
        name: "Firefox",
        vendor: "Mozilla",
        version: "153.0",
        buildID: "test",
    });
    message = new Message<MessageMap>();
    message["manager"].clear();
});

describe("watch method", () => {
    test("adds and removes the message listener on subscribe and unsubscribe", async () => {
        expect(chrome.runtime.onMessage.hasListeners()).toBe(false);

        const unsubscribe = message.watch("getStringLength", (str: string) => str.length);

        expect(chrome.runtime.onMessage.hasListeners()).toBe(true);
        expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function));

        unsubscribe();

        expect(chrome.runtime.onMessage.hasListeners()).toBe(false);
        expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalled();
    });

    test("registers a specific handler for a given message type", async () => {
        message.watch("getStringLength", (str: string) => str.length);
        message.watch("toUpperCase", (str: string) => str.toUpperCase());

        const result_1 = await message.send("getStringLength", "test");
        const result_2 = await message.send("toUpperCase", "test");

        expect(result_1).toBe(4);
        expect(result_2).toBe("TEST");
        expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    });

    test("registers async handler and resolves with its returned value", async () => {
        message.watch("fetchUser", name => new Promise(resolve => setTimeout(() => resolve({name}), 100)));

        const result = await message.send("fetchUser", "Tom");

        expect(result).toEqual({name: "Tom"});
    });

    test("registers multiple handlers using a handler object", async () => {
        message.watch({
            toUpperCase: str => str.toUpperCase(),
            getStringLength: str => str.length,
        });

        const result_1 = await message.send("getStringLength", "test");
        const result_2 = await message.send("toUpperCase", "test");

        expect(result_1).toBe(4);
        expect(result_2).toBe("TEST");
        expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    });

    test("registers a general handler for all message types", async () => {
        message.watch((type, data) => {
            console.log(`TYPE: ${type}, DATA: ${data}`);
        });

        const result_1 = await message.send("getStringLength", "test");
        const result_2 = await message.send("toUpperCase", "test");

        expect(result_1).toBe(undefined);
        expect(result_2).toBe(undefined);
        expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    });

    test("prioritizes the first registered handler over others for the same message type", async () => {
        message.watch("getStringLength", (str: string) => str.length);
        message.watch((type, data) => {
            console.log(`TYPE: ${type}, DATA: ${data}`);
        });

        const result_1 = await message.send("getStringLength", "test");
        const result_2 = await message.send("toUpperCase", "test");

        expect(result_1).toBe(4);
        expect(result_2).toBe(undefined);
        expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    });
});

describe("send method", () => {
    test("sends a message and returns the correct response from the handler", async () => {
        message.watch("getStringLength", str => str.length);

        const result = await message.send("getStringLength", "test");

        expect(result).toBe(4);
    });

    test("sends a message without data and receive a correct response from the handler", async () => {
        message.watch("sayHello", () => "Hello");

        const result = await message.send("sayHello", undefined);

        expect(result).toBe("Hello");
    });

    test("sends a message with correct structure", async () => {
        message.watch("getStringLength", str => str.length);

        const result = await message.send("getStringLength", "test");

        expect(result).toBe(4);
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            {
                id: expect.any(String),
                type: "getStringLength",
                data: "test",
                timestamp: expect.any(Number),
            },
            expect.any(Function)
        );
    });

    test("sends a message to tab when options is a number", async () => {
        message.watch("getStringLength", str => str.length);

        const result = await message.send("getStringLength", "test", 123);

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
            123,
            expect.objectContaining({type: "getStringLength", data: "test"}),
            undefined,
            expect.any(Function)
        );
        expect(result).toBe(4);
    });

    test("sends a message to tab when options is a object with tabId, frameId and documentId", async () => {
        message.watch("getStringLength", str => str.length);

        const result = await message.send("getStringLength", "test", {tabId: 123, frameId: 1, documentId: "1"});

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
            123,
            expect.objectContaining({type: "getStringLength", data: "test"}),
            {frameId: 1, documentId: "1"},
            expect.any(Function)
        );
        expect(result).toBe(4);
    });

    test("preserves documentId for Firefox 153 and newer", async () => {
        mockedEnv.isBrowser.mockReturnValue(true);

        message.watch("getStringLength", str => str.length);

        const result = await message.send("getStringLength", "test", {tabId: 123, frameId: 1, documentId: "1"});

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
            123,
            expect.objectContaining({type: "getStringLength", data: "test"}),
            {frameId: 1, documentId: "1"},
            expect.any(Function)
        );
        expect(mockedGetBrowserInfo).toHaveBeenCalledTimes(1);
        expect(result).toBe(4);
    });

    test("rejects documentId targeting on Firefox older than 153", async () => {
        mockedEnv.isBrowser.mockReturnValue(true);
        mockedGetBrowserInfo.mockResolvedValue({
            name: "Firefox",
            vendor: "Mozilla",
            version: "152.0",
            buildID: "test",
        });

        await expect(
            message.send("getStringLength", "test", {tabId: 123, documentId: "document-1"})
        ).rejects.toBeInstanceOf(UnsupportedMessageTargetError);
        expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    test("caches the Firefox version used for documentId capability checks", async () => {
        mockedEnv.isBrowser.mockReturnValue(true);
        message.watch("getStringLength", str => str.length);

        await message.send("getStringLength", "test", {tabId: 123, documentId: "document-1"});
        await message.send("getStringLength", "test", {tabId: 123, documentId: "document-2"});

        expect(mockedGetBrowserInfo).toHaveBeenCalledTimes(1);
    });

    test("rejects when a sync handler throws", async () => {
        message.watch("throwSync", data => {
            throw new TypeError(data);
        });

        await expect(message.send("throwSync", "sync boom")).rejects.toMatchObject({
            name: "TypeError",
            message: "sync boom",
        });
        await expect(message.send("throwSync", "sync boom")).rejects.toBeInstanceOf(TypeError);
    });

    test("marks restored handler errors as remote", async () => {
        message.watch("throwSync", data => {
            throw new TypeError(data);
        });

        const error = await message.send("throwSync", "sync boom").catch(cause => cause);

        expect(error).toBeInstanceOf(TypeError);
        expect(isRemoteMessageError(error)).toBe(true);
    });

    test("rejects when an async handler rejects", async () => {
        message.watch("throwAsync", async data => {
            throw new RangeError(data);
        });

        await expect(message.send("throwAsync", "async boom")).rejects.toMatchObject({
            name: "RangeError",
            message: "async boom",
        });
        await expect(message.send("throwAsync", "async boom")).rejects.toBeInstanceOf(RangeError);
    });

    test("rejects when a handler throws a primitive value", async () => {
        message.watch("throwPrimitive", data => {
            throw data;
        });

        await expect(message.send("throwPrimitive", "primitive boom")).rejects.toMatchObject({
            name: "Error",
            message: "primitive boom",
        });
    });

    test("rejects when a handler throws a plain object", async () => {
        message.watch("throwPlainObject", data => {
            throw {name: "CustomError", message: data};
        });

        await expect(message.send("throwPlainObject", "plain object boom")).rejects.toMatchObject({
            name: "CustomError",
            message: "plain object boom",
        });
    });

    test("returns envelope-like user data as payload", async () => {
        message.watch("envelopeLikePayload", () => ({ok: false, error: "user payload"}));

        await expect(message.send("envelopeLikePayload", undefined)).resolves.toEqual({
            ok: false,
            error: "user payload",
        });
    });

    test("returns raw invalid failure envelope as payload", async () => {
        (chrome.runtime.sendMessage as jest.Mock).mockImplementationOnce((msg, callback) => {
            callback?.({ok: false, error: "raw payload"});
        });

        await expect(message.send("rawEnvelopeLikePayload", undefined)).resolves.toEqual({
            ok: false,
            error: "raw payload",
        });
    });

    test("returns raw success envelope-like response as payload", async () => {
        (chrome.runtime.sendMessage as jest.Mock).mockImplementationOnce((msg, callback) => {
            callback?.({ok: true, payload: "raw payload"});
        });

        await expect(message.send("rawSuccessEnvelopeLikePayload", undefined)).resolves.toEqual({
            ok: true,
            payload: "raw payload",
        });
    });
});

describe("multiple handlers error for same message type", () => {
    const errorMessage =
        'Message type "getStringLength" has multiple handlers returning a response. Only one response is allowed.';

    test('with two "type" handlers', async () => {
        message.watch("getStringLength", () => 1);
        message.watch("getStringLength", () => 2);

        await expect(message.send("getStringLength", "test")).rejects.toThrow(errorMessage);
    });

    test('with two "map" handlers', async () => {
        message.watch({getStringLength: () => 1});
        message.watch({getStringLength: () => 2});

        await expect(message.send("getStringLength", "test")).rejects.toThrow(errorMessage);
    });

    test('with two "general" handlers', async () => {
        message.watch(() => 1);
        message.watch(() => 2);

        await expect(message.send("getStringLength", "test")).rejects.toThrow(errorMessage);
    });

    test('with "type" and "map" handlers', async () => {
        message.watch("getStringLength", () => 1);
        message.watch({getStringLength: () => 1});

        await expect(message.send("getStringLength", "test")).rejects.toThrow(errorMessage);
    });

    test('with "type" and "general" handlers', async () => {
        message.watch("getStringLength", () => 1);
        message.watch(() => 2);

        await expect(message.send("getStringLength", "test")).rejects.toThrow(errorMessage);
    });

    test('with "map" and "general" handlers', async () => {
        message.watch({getStringLength: () => 1});
        message.watch(() => 2);

        await expect(message.send("getStringLength", "test")).rejects.toThrow(errorMessage);
    });

    test("with two instances watching the same message type", async () => {
        const secondMessage = new Message<MessageMap>();
        message.watch("getStringLength", data => data.length);
        secondMessage.watch("getStringLength", data => data.length);

        await expect(message.send("getStringLength", "test")).rejects.toThrow(errorMessage);
    });

    test("allows multiple handlers if one of them don't return value", async () => {
        message.watch("getStringLength", data => data.length);
        message.watch((type, data) => {
            if (type === "toUpperCase") {
                return data?.toUpperCase();
            }
        });

        expect(await message.send("getStringLength", "test")).toBe(4);
    });
});
