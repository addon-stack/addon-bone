import {closeOffscreen, createOffscreen, hasOffscreen, hasOffscreenPath} from "@addon-core/browser";
import {isOffscreen} from "@offscreen/utils";

import {isBrowser} from "@main/env";

import MessageManager from "@message/MessageManager";

import ProxyOffscreen from "./ProxyOffscreen";
import RegisterOffscreen from "./RegisterOffscreen";
import OffscreenManager from "../OffscreenManager";

import {RpcAsyncProxy} from "@typing/rpc";
import {MessageTypeSeparator} from "@typing/message";

jest.mock("@offscreen/utils", () => ({isOffscreen: jest.fn()}));
jest.mock("@main/env", () => ({isBrowser: jest.fn()}));

const mockedCloseOffscreen = closeOffscreen as jest.MockedFunction<typeof closeOffscreen>;
const mockedCreateOffscreen = createOffscreen as jest.MockedFunction<typeof createOffscreen>;
const mockedHasOffscreen = hasOffscreen as jest.MockedFunction<typeof hasOffscreen>;
const mockedHasOffscreenPath = hasOffscreenPath as jest.MockedFunction<typeof hasOffscreenPath>;
const mockedIsBrowser = isBrowser as unknown as jest.Mock;
const mockedIsOffscreen = isOffscreen as jest.MockedFunction<typeof isOffscreen>;

type MockLockMode = "exclusive" | "shared";
type MockLockOptions = {mode: MockLockMode};
type MockLockCallback = () => unknown | Promise<unknown>;

type LockTask = {
    mode: MockLockMode;
    callback: MockLockCallback;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
};

class MockLockManager {
    private readonly queues = new Map<string, LockTask[]>();

    private readonly states = new Map<string, {shared: number; exclusive: boolean}>();

    public request(name: string, options: MockLockOptions, callback: MockLockCallback): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const queue = this.queues.get(name) ?? [];
            queue.push({mode: options.mode, callback, resolve, reject});
            this.queues.set(name, queue);
            this.drain(name);
        });
    }

    private state(name: string): {shared: number; exclusive: boolean} {
        const state = this.states.get(name) ?? {shared: 0, exclusive: false};

        this.states.set(name, state);

        return state;
    }

    private drain(name: string): void {
        const queue = this.queues.get(name);
        const state = this.state(name);

        if (!queue?.length || state.exclusive) {
            return;
        }

        const task = queue[0];

        if (task.mode === "exclusive") {
            if (state.shared > 0) {
                return;
            }

            queue.shift();
            state.exclusive = true;
            this.run(name, task);

            return;
        }

        while (queue[0]?.mode === "shared" && !state.exclusive) {
            const sharedTask = queue.shift()!;

            state.shared++;
            this.run(name, sharedTask);
        }
    }

    private run(name: string, task: LockTask): void {
        Promise.resolve()
            .then(task.callback)
            .then(task.resolve, task.reject)
            .finally(() => {
                const state = this.state(name);

                if (task.mode === "exclusive") {
                    state.exclusive = false;
                } else {
                    state.shared--;
                }

                this.drain(name);
            });
    }
}

let existingOffscreenPath: string | undefined;
let blockedResolvers: Array<() => void> = [];
let blockedStarted = 0;

const wait = (timeout = 0) => new Promise(resolve => setTimeout(resolve, timeout));
const waitForBlockedCalls = async (count: number): Promise<void> => {
    for (let attempt = 0; attempt < 10; attempt++) {
        if (blockedStarted >= count) {
            return;
        }

        await wait();
    }

    throw new Error(`Expected ${count} blocked offscreen calls to start, got ${blockedStarted}`);
};

beforeEach(async () => {
    jest.clearAllMocks();

    existingOffscreenPath = parameters.url;
    blockedResolvers = [];
    blockedStarted = 0;

    Object.defineProperty(navigator, "locks", {
        configurable: true,
        value: new MockLockManager(),
    });

    mockedHasOffscreen.mockImplementation(async () => existingOffscreenPath !== undefined);
    mockedHasOffscreenPath.mockImplementation(async (path: string) => existingOffscreenPath === path);
    mockedCloseOffscreen.mockImplementation(async () => {
        existingOffscreenPath = undefined;
    });
    mockedCreateOffscreen.mockImplementation(async (offscreenParameters: chrome.offscreen.CreateParameters) => {
        existingOffscreenPath = offscreenParameters.url;
    });

    OffscreenManager.getInstance().clear();
    MessageManager.getInstance().clear();

    new RegisterOffscreen(offscreenName, () => MatchService).register();
});

const MatchService = {
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

type OffscreenType = typeof MatchService;
type OffscreenProxyType = RpcAsyncProxy<OffscreenType>;

const offscreenName = "math";
const parameters = {
    reasons: ["TESTING" as const],
    url: "offscreen.html",
    justification: "for testing",
};

describe("ProxyOffscreen", () => {
    beforeEach(async () => {
        mockedIsOffscreen.mockReturnValue(false);
        mockedIsBrowser.mockReturnValue(false);
    });

    test("throws an error when get() is called in offscreen context", async () => {
        mockedIsOffscreen.mockReturnValue(true);

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
        existingOffscreenPath = undefined;

        const proxyInstance = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters);
        const offscreen = proxyInstance.get();

        await offscreen.sum(1, 2);

        await offscreen.sum(3, 4);

        expect(createOffscreen).toHaveBeenCalledTimes(1);
        expect(closeOffscreen).toHaveBeenCalledTimes(0);
    });

    test("recreates offscreen when URL changes", async () => {
        jest.clearAllMocks();
        existingOffscreenPath = undefined;

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

        expect(createOffscreen).toHaveBeenCalledTimes(2);
        expect(closeOffscreen).toHaveBeenCalledTimes(1);
    });

    test("runs same URL calls in parallel without recreating offscreen", async () => {
        const proxyInstance = new ProxyOffscreen<typeof offscreenName, OffscreenProxyType>(offscreenName, parameters);
        const offscreen = proxyInstance.get();

        const first = offscreen.blockedSum(1, 2);
        const second = offscreen.blockedSum(3, 4);

        await waitForBlockedCalls(2);

        blockedResolvers.forEach(resolve => resolve());

        await expect(Promise.all([first, second])).resolves.toEqual([3, 7]);

        expect(createOffscreen).toHaveBeenCalledTimes(0);
        expect(closeOffscreen).toHaveBeenCalledTimes(0);
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

        await wait();

        expect(createOffscreen).toHaveBeenCalledTimes(0);
        expect(closeOffscreen).toHaveBeenCalledTimes(0);

        blockedResolvers[0]();

        await expect(first).resolves.toBe(3);
        await expect(second).resolves.toBe(7);

        expect(closeOffscreen).toHaveBeenCalledTimes(1);
        expect(createOffscreen).toHaveBeenCalledWith(differentParams);
    });
});

describe("RegisterOffscreen", () => {
    beforeEach(async () => {
        mockedIsOffscreen.mockReturnValue(true);
    });

    test("throws an error when get() is called outside offscreen context", async () => {
        mockedIsOffscreen.mockReturnValue(false);

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
