import {closeOffscreen} from "@addon-core/browser";
import {getBrowserTest} from "@tests/browser-harness/session";
import MockLockManager from "@tests/offscreen/MockLockManager";
import {ProxyOffscreen, RegisterOffscreen} from "./index";
import {RpcAsyncProxy} from "@typing/rpc";
import {MessageTypeSeparator} from "@typing/message";
import {OffscreenGlobalAccess} from "@typing/offscreen";

let blockedResolvers: Array<() => void> = [];
let blockedStarted = 0;
let locks: MockLockManager;

const wait = () => new Promise(resolve => setTimeout(resolve));
const waitUntil = async (condition: () => boolean, description: string): Promise<void> => {
    const deadline = Date.now() + 2000;

    while (Date.now() < deadline) {
        if (condition()) {
            return;
        }

        await wait();
    }

    throw new Error(`Timed out waiting for ${description}`);
};

const waitForBlockedCalls = (count: number) =>
    waitUntil(() => blockedStarted >= count, `${count} blocked offscreen calls`);

const lifecycle = () => getBrowserTest().harness.offscreen;
const calls = () => getBrowserTest().harness.messaging.forContext(getBrowserTest().context).runtime.sendMessage.calls;

beforeEach(() => {
    const session = getBrowserTest();
    const descriptor = Object.getOwnPropertyDescriptor(navigator, "locks");

    blockedResolvers = [];
    blockedStarted = 0;
    locks = new MockLockManager();
    Object.defineProperty(navigator, "locks", {configurable: true, value: locks});
    session.addCleanup(() => {
        if (descriptor) {
            Object.defineProperty(navigator, "locks", descriptor);
        } else {
            Reflect.deleteProperty(navigator, "locks");
        }
    });

    // The kit owns document lifetime; this boundary hook starts the real application transport.
    // Replace the passthrough spy with a post-creation hook when the kit provides one (tests/README.md).
    const createContext = session.harness.contexts.create.bind(session.harness.contexts);

    jest.spyOn(session.harness.contexts, "create").mockImplementation(options => {
        const context = createContext(options);

        if (options.kind === "offscreen") {
            const restore = session.useContext(context);
            const registration = new RegisterOffscreen(offscreenName, () => mathService);

            try {
                registration.register();
            } finally {
                restore();
            }

            const detach = context.onDispose(() => registration.destroy());

            session.addCleanup(() => {
                detach();
                registration.destroy();
            });
        }

        return context;
    });

    session.harness.contexts.create({kind: "offscreen", url: chrome.runtime.getURL(parameters.url)});
});

const mathService = {
    sum: (a: number, b: number): number => a + b,
    asyncSum: (a: number, b: number): Promise<number> => {
        return new Promise(resolve => setTimeout(() => resolve(a + b), 100));
    },
    blockedSum: (a: number, b: number): Promise<number> => {
        blockedStarted++;

        return new Promise(resolve => {
            blockedResolvers.push(() => resolve(a + b));
        });
    },
    one: 1,
    obj: {
        concat: (a: string, b: string): string => a + " " + b,
        zero: 0,
    },
};

type OffscreenType = typeof mathService;
type OffscreenProxyType = RpcAsyncProxy<OffscreenType>;

const offscreenName = "math";
const parameters = {
    reasons: ["TESTING" as const],
    url: "offscreen.html",
    justification: "for testing",
};

describe("ProxyOffscreen", () => {
    test("throws an error when get() is called in offscreen context", async () => {
        globalThis[OffscreenGlobalAccess] = true;

        const proxy = new ProxyOffscreen(offscreenName, parameters);

        expect(() => proxy.get()).toThrow(
            `You are trying to get proxy offscreen service "${offscreenName}" from offscreen. You can get original offscreen service instead`
        );
    });

    test("returns a proxy when not in offscreen context", () => {
        const offscreen = new ProxyOffscreen(offscreenName, parameters).get();

        expect(Reflect.get(offscreen, "__proxy")).toBe(true);
    });

    test("invokes remote methods using Message.send", async () => {
        const offscreen = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters).get();

        expect(await offscreen.sum(1, 2)).toBe(3);
        expect(calls().at(-1)?.args).toEqual([
            expect.objectContaining({
                type: `offscreen${MessageTypeSeparator}${offscreenName}`,
                data: {
                    path: "sum",
                    args: [1, 2],
                },
            }),
        ]);
    });

    test("accesses property on offscreen service object ", async () => {
        const offscreen = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters).get();

        expect(await offscreen.one()).toBe(1);
        expect(calls().at(-1)?.args).toEqual([
            expect.objectContaining({
                type: `offscreen${MessageTypeSeparator}${offscreenName}`,
                data: {
                    path: "one",
                    args: [],
                },
            }),
        ]);
    });

    test("accesses nested method or property ", async () => {
        const offscreen = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters).get();

        expect(await offscreen.obj.concat("Hello", "world")).toBe("Hello world");
        expect(calls().at(-1)?.args).toEqual([
            expect.objectContaining({
                type: `offscreen${MessageTypeSeparator}${offscreenName}`,
                data: {
                    path: "obj.concat",
                    args: ["Hello", "world"],
                },
            }),
        ]);

        expect(await offscreen.obj.zero()).toBe(0);
        expect(calls().at(-1)?.args).toEqual([
            expect.objectContaining({
                type: `offscreen${MessageTypeSeparator}${offscreenName}`,
                data: {
                    path: "obj.zero",
                    args: [],
                },
            }),
        ]);
    });

    test("handles proxied async methods that return promises", async () => {
        const offscreen = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters).get();

        jest.useFakeTimers();

        const result = offscreen.asyncSum(1, 2);

        await jest.advanceTimersByTimeAsync(100);
        await expect(result).resolves.toBe(3);
    });

    test("does not recreate offscreen when URL hasn't changed", async () => {
        getBrowserTest().harness.contexts.remove(lifecycle().context!.info.contextId);

        const proxyInstance = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters);
        const offscreen = proxyInstance.get();

        await offscreen.sum(1, 2);

        await offscreen.sum(3, 4);

        expect(lifecycle().createDocument.calls).toHaveLength(1);
        expect(lifecycle().closeDocument.calls).toHaveLength(0);
    });

    test("recreates offscreen when URL changes", async () => {
        getBrowserTest().harness.contexts.remove(lifecycle().context!.info.contextId);

        const proxyInstance1 = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters);
        const offscreen1 = proxyInstance1.get();
        await offscreen1.sum(1, 2);

        const differentParams = {...parameters, url: "different-offscreen.html"};
        const proxyInstance2 = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(
            offscreenName,
            differentParams
        );
        const offscreen2 = proxyInstance2.get();
        await offscreen2.sum(3, 4);

        expect(lifecycle().createDocument.calls).toHaveLength(2);
        expect(lifecycle().closeDocument.calls).toHaveLength(1);
    });

    test("runs same URL calls in parallel without recreating offscreen", async () => {
        const proxyInstance = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters);
        const offscreen = proxyInstance.get();

        const first = offscreen.blockedSum(1, 2);
        const second = offscreen.blockedSum(3, 4);

        await waitForBlockedCalls(2);

        blockedResolvers.forEach(resolve => resolve());

        await expect(Promise.all([first, second])).resolves.toEqual([3, 7]);

        expect(lifecycle().createDocument.calls).toHaveLength(0);
        expect(lifecycle().closeDocument.calls).toHaveLength(0);
    });

    test("waits for active calls before switching to a different URL", async () => {
        const proxyInstance1 = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters);
        const offscreen1 = proxyInstance1.get();
        const first = offscreen1.blockedSum(1, 2);

        await waitForBlockedCalls(1);

        const differentParams = {...parameters, url: "different-offscreen.html"};
        const proxyInstance2 = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(
            offscreenName,
            differentParams
        );
        const offscreen2 = proxyInstance2.get();
        const second = offscreen2.sum(3, 4);

        await waitUntil(() => locks.pending("adnbn:offscreen:active") === 1, "the exclusive URL switch lock");

        expect(lifecycle().createDocument.calls).toHaveLength(0);
        expect(lifecycle().closeDocument.calls).toHaveLength(0);

        blockedResolvers[0]();

        await expect(first).resolves.toBe(3);
        await expect(second).resolves.toBe(7);

        expect(lifecycle().closeDocument.calls).toHaveLength(1);
        expect(lifecycle().createDocument.calls.at(-1)?.args).toEqual([differentParams]);
    });
});

test("recreates a document closed between calls", async () => {
    const proxy = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters).get();
    const previous = lifecycle().context!;

    await expect(proxy.sum(1, 2)).resolves.toBe(3);
    await closeOffscreen();
    expect(previous.disposed).toBe(true);
    await expect(proxy.sum(3, 4)).resolves.toBe(7);
    expect(lifecycle().context).not.toBe(previous);
    expect(lifecycle().createDocument.calls).toHaveLength(1);
});

test("releases lifecycle locks after creation failure so a later call can retry", async () => {
    getBrowserTest().harness.contexts.remove(lifecycle().context!.info.contextId);
    lifecycle().beforeCreate.failNext(new Error("Creation failed"));

    const proxy = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters).get();

    await expect(proxy.sum(1, 2)).rejects.toThrow("Creation failed");
    expect(lifecycle().context).toBeUndefined();
    await expect(proxy.sum(3, 4)).resolves.toBe(7);
    expect(lifecycle().createDocument.calls).toHaveLength(2);
});

test("keeps the existing document and releases locks after closure failure", async () => {
    const previous = lifecycle().context!;
    const otherParameters = {...parameters, url: "other-offscreen.html"};
    const proxy = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, otherParameters).get();

    lifecycle().beforeClose.failNext(new Error("Closure failed"));

    await expect(proxy.sum(1, 2)).rejects.toThrow("Closure failed");
    expect(lifecycle().context).toBe(previous);
    expect(previous.disposed).toBe(false);
    expect(lifecycle().createDocument.calls).toHaveLength(0);
    await expect(proxy.sum(3, 4)).resolves.toBe(7);
    expect(previous.disposed).toBe(true);
    expect(lifecycle().createDocument.calls).toHaveLength(1);
});

test("releases the active lock after messaging failure before switching URL", async () => {
    const session = getBrowserTest();
    const sender = session.harness.messaging.forContext(session.context);
    const proxy = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters).get();

    sender.runtime.sendMessage.failNext(new Error("Channel closed"));

    await expect(proxy.sum(1, 2)).rejects.toThrow("Channel closed");

    const other = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, {
        ...parameters,
        url: "other-offscreen.html",
    }).get();

    await expect(other.sum(3, 4)).resolves.toBe(7);
    expect(lifecycle().closeDocument.calls).toHaveLength(1);
});

test("serializes concurrent creation and sends only after the document is ready", async () => {
    getBrowserTest().harness.contexts.remove(lifecycle().context!.info.contextId);

    let release!: () => void;
    const pending = new Promise<void>(resolve => {
        release = resolve;
    });

    lifecycle().beforeCreate.setImplementation(() => pending);

    const proxy = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters).get();
    const first = proxy.sum(1, 2);
    const second = proxy.sum(3, 4);

    await waitUntil(() => lifecycle().beforeCreate.calls.length === 1, "offscreen creation to start");
    expect(lifecycle().context).toBeUndefined();
    expect(calls()).toHaveLength(0);
    expect(lifecycle().createDocument.calls).toHaveLength(1);
    release();

    await expect(Promise.all([first, second])).resolves.toEqual([3, 7]);
    expect(lifecycle().createDocument.calls).toHaveLength(1);
});
