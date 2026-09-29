import Message from "./Message";
import {createTabFixture, type BrowserContext} from "@addon-core/browser/testing";
import {getBrowserTest} from "@tests/browser-harness/session";
import type {MessageData, MessageResponse, MessageSendOptions, MessageType} from "@typing/message";

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
let receiver: BrowserContext;

beforeEach(() => {
    const session = getBrowserTest();

    receiver = session.harness.contexts.create({kind: "background"});
    session.useContext(receiver);
    message = new Message<MessageMap>();
});

const caller = () => {
    const session = getBrowserTest();

    return session.harness.messaging.forContext(session.context);
};

// Each call completes before restoring the receiver globals used for registrations.
async function sendFromCaller<K extends MessageType<MessageMap>>(
    type: K,
    data: MessageData<MessageMap, K>,
    options?: MessageSendOptions
): Promise<MessageResponse<MessageMap, K>> {
    const session = getBrowserTest();
    const restore = session.useContext(session.context);

    try {
        return await message.send(type, data, options);
    } finally {
        restore();
    }
}

function useTabReceiver(): void {
    const session = getBrowserTest();

    session.harness.tabs.set([createTabFixture({id: 123})]);
    session.harness.contexts.documents.create({
        documentId: "document-1",
        tabId: 123,
        frameId: 1,
        url: "https://example.test/",
    });
    receiver = session.harness.contexts.create({
        kind: "contentScript",
        tabId: 123,
        frameId: 1,
        documentId: "document-1",
        url: "https://example.test/",
    });
    session.useContext(receiver);
}

function useFirefox(version = "153.0"): void {
    const session = getBrowserTest();

    session.useContext(receiver, "firefox");
    session.harness.runtime.getBrowserInfo.setResult({name: "Firefox", vendor: "Mozilla", version, buildID: "test"});
}

describe("watch method", () => {
    test("adds and removes the message listener on subscribe and unsubscribe", async () => {
        expect(receiver.onMessage.listenerCount()).toBe(0);

        const unsubscribe = message.watch("getStringLength", (str: string) => str.length);

        expect(receiver.onMessage.listenerCount()).toBe(1);

        unsubscribe();

        expect(receiver.onMessage.listenerCount()).toBe(0);
    });

    test("registers a specific handler for a given message type", async () => {
        message.watch("getStringLength", (str: string) => str.length);
        message.watch("toUpperCase", (str: string) => str.toUpperCase());

        const firstResult = await sendFromCaller("getStringLength", "test");
        const secondResult = await sendFromCaller("toUpperCase", "test");

        expect(firstResult).toBe(4);
        expect(secondResult).toBe("TEST");
        expect(receiver.onMessage.listenerCount()).toBe(1);
    });

    test("registers async handler and resolves with its returned value", async () => {
        message.watch("fetchUser", async name => ({name}));

        const result = await sendFromCaller("fetchUser", "Tom");

        expect(result).toEqual({name: "Tom"});
    });

    test("registers multiple handlers using a handler object", async () => {
        message.watch({
            toUpperCase: str => str.toUpperCase(),
            getStringLength: str => str.length,
        });

        const firstResult = await sendFromCaller("getStringLength", "test");
        const secondResult = await sendFromCaller("toUpperCase", "test");

        expect(firstResult).toBe(4);
        expect(secondResult).toBe("TEST");
        expect(receiver.onMessage.listenerCount()).toBe(1);
    });

    test("delivers every type to a general handler even when it sends no response", async () => {
        const received: unknown[] = [];

        message.watch((type, data) => {
            received.push({type, data});
        });

        await expect(sendFromCaller("getStringLength", "test")).rejects.toThrow("message port closed");
        await expect(sendFromCaller("toUpperCase", "test")).rejects.toThrow("message port closed");
        expect(received).toEqual([
            {type: "getStringLength", data: "test"},
            {type: "toUpperCase", data: "test"},
        ]);
        expect(receiver.onMessage.listenerCount()).toBe(1);
    });

    test("uses the response handler alongside a general observer", async () => {
        const received: string[] = [];

        message.watch("getStringLength", str => str.length);
        message.watch(type => {
            received.push(type);
        });

        await expect(sendFromCaller("getStringLength", "test")).resolves.toBe(4);
        await expect(sendFromCaller("toUpperCase", "test")).rejects.toThrow("message port closed");
        expect(received).toEqual(["getStringLength", "toUpperCase"]);
        expect(receiver.onMessage.listenerCount()).toBe(1);
    });
});

describe("send method", () => {
    test("sends a message and returns the correct response from the handler", async () => {
        message.watch("getStringLength", str => str.length);

        const result = await sendFromCaller("getStringLength", "test");

        expect(result).toBe(4);
    });

    test("sends a message without data and receive a correct response from the handler", async () => {
        message.watch("sayHello", () => "Hello");

        const result = await sendFromCaller("sayHello", undefined);

        expect(result).toBe("Hello");
    });

    test("sends a message with correct structure", async () => {
        message.watch("getStringLength", str => str.length);

        const result = await sendFromCaller("getStringLength", "test");

        expect(result).toBe(4);
        expect(caller().runtime.sendMessage.calls[0].args).toEqual([
            {
                id: expect.any(String),
                type: "getStringLength",
                data: "test",
                timestamp: expect.any(Number),
            },
        ]);
    });

    test("sends a message to tab when options is a number", async () => {
        useTabReceiver();
        message.watch("getStringLength", str => str.length);

        const result = await sendFromCaller("getStringLength", "test", 123);

        expect(caller().tabs.sendMessage.calls[0].args).toEqual([
            123,
            expect.objectContaining({type: "getStringLength", data: "test"}),
            {},
        ]);
        expect(result).toBe(4);
    });

    test("sends a message to the addressed tab, frame and document", async () => {
        useTabReceiver();
        message.watch("getStringLength", str => str.length);

        const result = await sendFromCaller("getStringLength", "test", {
            tabId: 123,
            frameId: 1,
            documentId: "document-1",
        });

        expect(caller().tabs.sendMessage.calls[0].args).toEqual([
            123,
            expect.objectContaining({type: "getStringLength", data: "test"}),
            {frameId: 1, documentId: "document-1"},
        ]);
        expect(result).toBe(4);
    });

    test("preserves documentId for Firefox 153 and newer", async () => {
        useTabReceiver();
        useFirefox();

        message.watch("getStringLength", str => str.length);

        const result = await sendFromCaller("getStringLength", "test", {
            tabId: 123,
            frameId: 1,
            documentId: "document-1",
        });

        expect(caller().tabs.sendMessage.calls[0].args).toEqual([
            123,
            expect.objectContaining({type: "getStringLength", data: "test"}),
            {frameId: 1, documentId: "document-1"},
        ]);
        expect(getBrowserTest().harness.runtime.getBrowserInfo.calls).toHaveLength(1);
        expect(result).toBe(4);
    });

    test("rejects documentId targeting on Firefox older than 153", async () => {
        useTabReceiver();
        useFirefox("152.0");

        await expect(
            sendFromCaller("getStringLength", "test", {tabId: 123, documentId: "document-1"})
        ).rejects.toBeInstanceOf(UnsupportedMessageTargetError);
        expect(caller().tabs.sendMessage.calls).toHaveLength(0);
    });

    test("caches the Firefox version used for documentId capability checks", async () => {
        useTabReceiver();
        useFirefox();
        message.watch("getStringLength", str => str.length);

        await sendFromCaller("getStringLength", "test", {tabId: 123, documentId: "document-1"});
        await sendFromCaller("getStringLength", "again", {tabId: 123, documentId: "document-1"});

        expect(getBrowserTest().harness.runtime.getBrowserInfo.calls).toHaveLength(1);
    });

    test.each(["frame", "document"] as const)("delivers only to the selected %s", async selector => {
        useTabReceiver();
        message.watch("getStringLength", str => str.length);

        const {harness} = getBrowserTest();
        const sibling = harness.contexts.create({
            kind: "contentScript",
            tabId: 123,
            frameId: 2,
            url: "https://example.test/other",
        });
        const received: unknown[] = [];

        sibling.onMessage.on((body, _sender, reply) => {
            received.push(body);
            reply("wrong frame");
        });

        const options: MessageSendOptions =
            selector === "frame" ? {tabId: 123, frameId: 1} : {tabId: 123, documentId: "document-1"};

        await expect(sendFromCaller("getStringLength", "test", options)).resolves.toBe(4);
        expect(received).toEqual([]);
    });

    test("does not deliver to another tab", async () => {
        useTabReceiver();
        message.watch("getStringLength", str => str.length);
        getBrowserTest().harness.tabs.set([createTabFixture({id: 123}), createTabFixture({id: 456})]);

        const result = sendFromCaller("getStringLength", "test", 456);

        await expect(result).rejects.toThrow("Receiving end does not exist");
        expect(isRemoteMessageError(await result.catch(error => error))).toBe(false);
    });

    test("rejects an unknown Firefox version before sending to a document", async () => {
        useTabReceiver();
        useFirefox("unknown");

        await expect(
            sendFromCaller("getStringLength", "test", {tabId: 123, documentId: "document-1"})
        ).rejects.toBeInstanceOf(UnsupportedMessageTargetError);
        expect(caller().tabs.sendMessage.calls).toHaveLength(0);
    });

    test("preserves a failed Firefox version lookup as the capability error cause", async () => {
        useTabReceiver();
        useFirefox();

        const cause = new Error("Browser info unavailable");

        getBrowserTest().harness.runtime.getBrowserInfo.failNext(cause);

        const result = sendFromCaller("getStringLength", "test", {tabId: 123, documentId: "document-1"});

        await expect(result).rejects.toBeInstanceOf(UnsupportedMessageTargetError);
        await expect(result).rejects.toMatchObject({cause: {message: cause.message}});
        expect(caller().tabs.sendMessage.calls).toHaveLength(0);
    });

    test("rejects when a sync handler throws", async () => {
        message.watch("throwSync", data => {
            throw new TypeError(data);
        });

        await expect(sendFromCaller("throwSync", "sync boom")).rejects.toMatchObject({
            name: "TypeError",
            message: "sync boom",
        });
        await expect(sendFromCaller("throwSync", "sync boom")).rejects.toBeInstanceOf(TypeError);
    });

    test("marks restored handler errors as remote", async () => {
        message.watch("throwSync", data => {
            throw new TypeError(data);
        });

        const error = await sendFromCaller("throwSync", "sync boom").catch(cause => cause);

        expect(error).toBeInstanceOf(TypeError);
        expect(isRemoteMessageError(error)).toBe(true);
    });

    test("rejects when an async handler rejects", async () => {
        message.watch("throwAsync", async data => {
            throw new RangeError(data);
        });

        await expect(sendFromCaller("throwAsync", "async boom")).rejects.toMatchObject({
            name: "RangeError",
            message: "async boom",
        });
        await expect(sendFromCaller("throwAsync", "async boom")).rejects.toBeInstanceOf(RangeError);
    });

    test("rejects when a handler throws a primitive value", async () => {
        message.watch("throwPrimitive", data => {
            throw data;
        });

        await expect(sendFromCaller("throwPrimitive", "primitive boom")).rejects.toMatchObject({
            name: "Error",
            message: "primitive boom",
        });
    });

    test("rejects when a handler throws a plain object", async () => {
        message.watch("throwPlainObject", data => {
            throw {name: "CustomError", message: data};
        });

        await expect(sendFromCaller("throwPlainObject", "plain object boom")).rejects.toMatchObject({
            name: "CustomError",
            message: "plain object boom",
        });
    });

    test("returns envelope-like user data as payload", async () => {
        message.watch("envelopeLikePayload", () => ({ok: false, error: "user payload"}));

        await expect(sendFromCaller("envelopeLikePayload", undefined)).resolves.toEqual({
            ok: false,
            error: "user payload",
        });
    });

    test("returns raw invalid failure envelope as payload", async () => {
        receiver.onMessage.on((_message, _sender, reply) => {
            reply({ok: false, error: "raw payload"});
        });

        await expect(sendFromCaller("rawEnvelopeLikePayload", undefined)).resolves.toEqual({
            ok: false,
            error: "raw payload",
        });
    });

    test("returns raw success envelope-like response as payload", async () => {
        receiver.onMessage.on((_message, _sender, reply) => {
            reply({ok: true, payload: "raw payload"});
        });

        await expect(sendFromCaller("rawSuccessEnvelopeLikePayload", undefined)).resolves.toEqual({
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

        await expect(sendFromCaller("getStringLength", "test")).rejects.toThrow(errorMessage);
    });

    test('with two "map" handlers', async () => {
        message.watch({getStringLength: () => 1});
        message.watch({getStringLength: () => 2});

        await expect(sendFromCaller("getStringLength", "test")).rejects.toThrow(errorMessage);
    });

    test('with two "general" handlers', async () => {
        message.watch(() => 1);
        message.watch(() => 2);

        await expect(sendFromCaller("getStringLength", "test")).rejects.toThrow(errorMessage);
    });

    test('with "type" and "map" handlers', async () => {
        message.watch("getStringLength", () => 1);
        message.watch({getStringLength: () => 1});

        await expect(sendFromCaller("getStringLength", "test")).rejects.toThrow(errorMessage);
    });

    test('with "type" and "general" handlers', async () => {
        message.watch("getStringLength", () => 1);
        message.watch(() => 2);

        await expect(sendFromCaller("getStringLength", "test")).rejects.toThrow(errorMessage);
    });

    test('with "map" and "general" handlers', async () => {
        message.watch({getStringLength: () => 1});
        message.watch(() => 2);

        await expect(sendFromCaller("getStringLength", "test")).rejects.toThrow(errorMessage);
    });

    test("with two instances watching the same message type", async () => {
        const secondMessage = new Message<MessageMap>();
        message.watch("getStringLength", data => data.length);
        secondMessage.watch("getStringLength", data => data.length);

        await expect(sendFromCaller("getStringLength", "test")).rejects.toThrow(errorMessage);
    });

    test("allows multiple handlers if one of them don't return value", async () => {
        message.watch("getStringLength", data => data.length);
        message.watch((type, data) => {
            if (type === "toUpperCase") {
                return data?.toUpperCase();
            }
        });

        expect(await sendFromCaller("getStringLength", "test")).toBe(4);
    });
});
