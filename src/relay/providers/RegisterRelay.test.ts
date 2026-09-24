import {createTabFixture} from "@addon-core/browser/testing";
import {getBrowserTest} from "@tests/browser-harness/session";
import {RelayGlobalKey, RelayMethod} from "@typing/relay";
import RelayManager from "../RelayManager";
import RegisterRelay from "./RegisterRelay";
import RelayMessagingAdapter from "../adapters/RelayMessagingAdapter";

const math = {sum: (a: number, b: number): number => a + b};

beforeEach(() => {
    new RegisterRelay("math", RelayMethod.Scripting, () => math).register();
});

test("rejects access outside the Relay content context", () => {
    Reflect.deleteProperty(globalThis, RelayGlobalKey);

    expect(() => new RegisterRelay("math", RelayMethod.Scripting, () => math).get()).toThrow(
        'Relay "math" can be getting only from content script'
    );
});

test("returns the registered object and calls it directly without scripting", () => {
    const relay = new RegisterRelay("math", RelayMethod.Scripting, () => math).get();

    expect(relay).toBe(math);
    expect(relay.sum(1, 2)).toBe(3);
    expect(getBrowserTest().harness.scripting.executeScript.calls).toHaveLength(0);
});

test("rejects duplicate scripting registrations", () => {
    expect(() => new RegisterRelay("math", RelayMethod.Scripting, () => math).register()).toThrow(
        'A relay with the name "math" already exists. The relay name must be unique.'
    );
});

test.each([RelayMethod.Scripting, RelayMethod.Messaging])("owns registration and cleanup for %s", method => {
    const session = getBrowserTest();
    const register = new RegisterRelay("another", method, () => math);

    expect(register.register()).toBe(math);
    expect(RelayManager.getInstance().get("another")).toBe(math);
    expect(session.context.onMessage.listenerCount()).toBe(method === RelayMethod.Messaging ? 1 : 0);
    register.destroy();
    expect(RelayManager.getInstance().has("another")).toBe(false);
    expect(session.context.onMessage.listenerCount()).toBe(0);
});

test("serves a real Relay messaging call from a different context", async () => {
    const session = getBrowserTest();
    session.harness.tabs.set([createTabFixture({id: 1})]);

    const receiver = session.harness.contexts.create({
        kind: "contentScript",
        tabId: 1,
        frameId: 0,
        url: "https://example.com/",
    });
    const restore = session.useContext(receiver);
    const register = new RegisterRelay("remote", RelayMethod.Messaging, () => math);

    register.register();
    session.addCleanup(() => register.destroy());
    restore();

    const adapter = new RelayMessagingAdapter("remote", {tabId: 1, frameId: 0});

    await expect(adapter.invoke([2, 3], "sum")).resolves.toBe(5);
    expect(receiver.onMessage.listenerCount()).toBe(1);
    register.destroy();
    expect(receiver.onMessage.listenerCount()).toBe(0);
    await expect(adapter.invoke([2, 3], "sum")).rejects.toThrow(/Receiving end does not exist/);
});
