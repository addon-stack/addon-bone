import React from "react";
import {act, cleanup, renderHook} from "@testing-library/react";
import type {BrowserContextMessaging} from "@addon-core/browser/testing";
import {getBrowserTest} from "@tests/browser-harness/session";
import type {MessageData, MessageTargetHandler, MessageType} from "@typing/message";
import {Message} from "@message/providers";
import {useMessageHandler} from "./index";

type MessageMap = {
    getStringLength: (data: string) => number;
    toUpperCase: (str: string) => string;
    sayHello: (data?: string) => string;
};
type TextMessageType = "getStringLength" | "toUpperCase";
type TextMessageHandler = MessageTargetHandler<MessageMap, TextMessageType>;
type TextHandlerProps = {type: TextMessageType; handler: TextMessageHandler};
type BooleanMessages = {isEnabled: () => boolean};

let caller: BrowserContextMessaging;
let addListener: jest.SpyInstance;
let removeListener: jest.SpyInstance;

beforeEach(() => {
    const session = getBrowserTest();
    const sender = session.harness.contexts.create({kind: "background"});

    caller = session.harness.messaging.forContext(sender);
    // Observe the browser boundary while retaining its real registration behavior.
    addListener = jest.spyOn(chrome.runtime.onMessage, "addListener");
    removeListener = jest.spyOn(chrome.runtime.onMessage, "removeListener");
    session.addCleanup(cleanup);
});

const listenerCount = () => getBrowserTest().context.onMessage.listenerCount();

function send<K extends MessageType<MessageMap>>(type: K, data: MessageData<MessageMap, K>): Promise<unknown> {
    return caller.chrome.runtime.sendMessage({id: "hook-test", type, data, timestamp: 0});
}

function useHarness<K extends MessageType<MessageMap>>(type: K, handler: MessageTargetHandler<MessageMap, K>) {
    const rendersRef = React.useRef(0);

    rendersRef.current++;
    useMessageHandler<K, MessageMap>(type, handler);

    return {renders: rendersRef.current};
}

test("registers a handler and responds to another browser context", async () => {
    expect(listenerCount()).toBe(0);

    renderHook(() => useMessageHandler<"getStringLength", MessageMap>("getStringLength", str => str.length));

    expect(listenerCount()).toBe(1);
    await expect(send("getStringLength", "test")).resolves.toMatchObject({ok: true, payload: 4});
});

test("preserves a synchronous false response through the hook", async () => {
    renderHook(() => useMessageHandler<"isEnabled", BooleanMessages>("isEnabled", () => false));

    await expect(caller.chrome.runtime.sendMessage({type: "isEnabled"})).resolves.toMatchObject({
        ok: true,
        payload: false,
    });
});

test("adds and removes the listener on mount and unmount", async () => {
    const {unmount} = renderHook(() =>
        useMessageHandler<"getStringLength", MessageMap>("getStringLength", str => str.length)
    );

    expect(listenerCount()).toBe(1);
    unmount();
    expect(listenerCount()).toBe(0);
    await expect(send("getStringLength", "test")).rejects.toThrow("Receiving end does not exist");
});

test("updates the handler without resubscribing and resubscribes on type changes", async () => {
    const initialProps: TextHandlerProps = {type: "getStringLength", handler: str => str.length};
    const {rerender} = renderHook(
        ({type, handler}: TextHandlerProps) => useMessageHandler<TextMessageType, MessageMap>(type, handler),
        {initialProps}
    );

    await expect(send("getStringLength", "test")).resolves.toMatchObject({payload: 4});
    expect(addListener).toHaveBeenCalledTimes(1);
    expect(removeListener).not.toHaveBeenCalled();

    rerender({type: "getStringLength", handler: str => str.length / 2});

    expect(addListener).toHaveBeenCalledTimes(1);
    expect(removeListener).not.toHaveBeenCalled();
    await expect(send("getStringLength", "test")).resolves.toMatchObject({payload: 2});

    rerender({type: "toUpperCase", handler: str => str.toUpperCase()});

    expect(addListener).toHaveBeenCalledTimes(2);
    expect(removeListener).toHaveBeenCalledTimes(1);
    expect(listenerCount()).toBe(1);
    await expect(send("toUpperCase", "test")).resolves.toMatchObject({payload: "TEST"});
    await expect(send("getStringLength", "test")).resolves.toBeUndefined();
});

test("uses Message.getInstance once across rerenders", () => {
    const spy = jest.spyOn(Message, "getInstance");
    const {rerender, unmount} = renderHook(
        ({handler}) => useMessageHandler<"sayHello", MessageMap>("sayHello", handler),
        {initialProps: {handler: (name?: string) => `Hello ${name ?? ""}`.trim()}}
    );

    expect(spy).toHaveBeenCalledTimes(1);
    rerender({handler: (name?: string) => `Hi ${name ?? ""}`.trim()});
    expect(spy).toHaveBeenCalledTimes(1);
    unmount();
    expect(listenerCount()).toBe(0);
});

test("does not rerender on messages when the handler does not update state", async () => {
    const {result} = renderHook(() => useHarness("sayHello", (data?: string) => (data ? `Hello ${data}` : "Hello")));

    expect(result.current.renders).toBe(1);

    await act(async () => {
        await expect(send("sayHello", "John")).resolves.toMatchObject({payload: "Hello John"});
    });

    expect(result.current.renders).toBe(1);
});

test("changing the handler adds one render without resubscribing", () => {
    const {result, rerender} = renderHook(({handler}) => useHarness("getStringLength", handler), {
        initialProps: {handler: (str: string) => str.length},
    });
    const rendersBefore = result.current.renders;

    rerender({handler: str => Math.floor(str.length / 2)});

    expect(addListener).toHaveBeenCalledTimes(1);
    expect(removeListener).not.toHaveBeenCalled();
    expect(result.current.renders).toBe(rendersBefore + 1);
});

test("changing the type resubscribes and adds one render", () => {
    const initialProps: TextHandlerProps = {type: "getStringLength", handler: str => str.length};
    const {result, rerender} = renderHook(({type, handler}: TextHandlerProps) => useHarness(type, handler), {
        initialProps,
    });
    const rendersBefore = result.current.renders;

    rerender({type: "toUpperCase", handler: str => str.toUpperCase()});

    expect(addListener).toHaveBeenCalledTimes(2);
    expect(removeListener).toHaveBeenCalledTimes(1);
    expect(result.current.renders).toBe(rendersBefore + 1);
});

test("keeps one live subscription under StrictMode and removes it on unmount", async () => {
    const Wrapper: React.FC<{children: React.ReactNode}> = ({children}) =>
        React.createElement(React.StrictMode, null, children);
    const {unmount} = renderHook(() => useMessageHandler<"sayHello", MessageMap>("sayHello", () => "pong"), {
        wrapper: Wrapper,
    });

    expect(listenerCount()).toBe(1);
    await expect(send("sayHello", undefined)).resolves.toMatchObject({payload: "pong"});
    unmount();
    expect(listenerCount()).toBe(0);
    expect(removeListener.mock.calls.length).toBe(addListener.mock.calls.length);
});
