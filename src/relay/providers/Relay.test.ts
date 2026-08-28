import {getAllFrames, getManifest} from "@addon-core/browser";

import TransportMessage from "@transport/TransportMessage";
import {markRemoteMessageError} from "@message/error";

import ProxyRelay, {type ProxyRelayParams} from "./ProxyRelay";
import RegisterRelay from "./RegisterRelay";
import RelayManager from "../RelayManager";
import RelayPermission from "../RelayPermission";
import {isRelayContext} from "../utils";

import {
    RelayAllFrames,
    RelayBatchRpcProxy,
    RelayFrameErrorKind,
    RelayGlobalKey,
    RelayMethod,
    RelayOptions,
} from "@typing/relay";
import {RpcAsyncProxy} from "@typing/rpc";

const mockedGetAllFrames = getAllFrames as jest.MockedFunction<typeof getAllFrames>;
const mockedGetManifest = getManifest as jest.MockedFunction<typeof getManifest>;
const activationOrder: string[] = [];
let relayPermission: RelayPermission;

const manifest = {
    manifest_version: 3,
    name: "Relay test",
    version: "1.0.0",
} satisfies ReturnType<typeof getManifest>;

beforeEach(async () => {
    jest.clearAllMocks();
    activationOrder.splice(0);

    RelayManager.getInstance().clear();

    new RegisterRelay(relayName, RelayMethod.Scripting, () => MatchRelay).register();

    relayPermission = {
        allow: jest.fn().mockReturnValue(true),
        request: jest.fn().mockResolvedValue(true),
    } as unknown as RelayPermission;

    mockedGetManifest.mockReturnValue({...manifest, permissions: []});
    mockedGetAllFrames.mockResolvedValue([]);
});

const MatchRelay = {
    sum: (a: number, b: number): number => a + b,
    asyncSum: (a: number, b: number): Promise<number> => {
        return new Promise(resolve => setTimeout(() => resolve(a + b), 100));
    },
    activation: (): boolean => {
        activationOrder.push("relay");
        return true;
    },
    fail: (): never => {
        throw new TypeError("Remote failure");
    },
    one: 1,
    obj: {
        concat: (a: string, b: string): string => a + " " + b,
        zero: 0,
    },
};

type RelayType = typeof MatchRelay;
type RelayProxyType = RpcAsyncProxy<RelayType>;
type RelayBatchProxyType = RelayBatchRpcProxy<RelayType>;

const relayName = "math";

const options: RelayOptions = {
    name: "",
    method: RelayMethod.Scripting,
};

const createProxyRelay = <T = RelayProxyType>(relayOptions: RelayOptions, params: ProxyRelayParams) => {
    return new ProxyRelay<typeof relayName, T>(relayName, relayOptions, params, relayPermission);
};

const expectScriptInjection = (expected: Partial<chrome.scripting.ScriptInjection<any[], any>>) => {
    const [injection] = (chrome.scripting.executeScript as jest.Mock).mock.calls.at(-1);

    expect(injection).toEqual(expect.objectContaining(expected));
};

const expectScriptTargets = (expected: chrome.scripting.InjectionTarget[]) => {
    const targets = (chrome.scripting.executeScript as jest.Mock).mock.calls.map(([injection]) => injection.target);

    expect(targets).toEqual(expected);
};

describe("ProxyRelay", () => {
    beforeEach(async () => {
        (isRelayContext as jest.Mock).mockReturnValue(false);
    });

    test("throws an error when get() is called in content script context", async () => {
        (isRelayContext as jest.Mock).mockReturnValue(true);

        const proxy = createProxyRelay(options, 1);

        expect(() => proxy.get()).toThrow(
            `You are trying to get proxy relay "${relayName}" from script content. You can get original relay instead`
        );
    });

    test("returns a proxy when called not in content script context", () => {
        const relay = createProxyRelay(options, 1).get();

        expect(relay["__proxy"]).toBe(true);
    });

    test("validates the target before returning a proxy", () => {
        expect(() => createProxyRelay(options, {tabId: 1, frameId: 0, allFrames: true} as any).get()).toThrow(
            "selectors are mutually exclusive"
        );
        expect(() => createProxyRelay(options, {tabId: 1, frameIds: []} as any).get()).toThrow(
            '"frameIds" must be a non-empty array'
        );
        expect(() => createProxyRelay(options, {tabId: 1, frameIds: [0, 0]} as any).get()).toThrow(
            '"frameIds" must not contain duplicate values'
        );
        expect(() => createProxyRelay(options, {tabId: 1, documentIds: [""]} as any).get()).toThrow(
            '"documentIds" must contain only non-empty strings'
        );
        expect(() => createProxyRelay(options, {tabId: 1, allFrames: "invalid"} as any).get()).toThrow(
            '"allFrames" accepts only false, true, RelayAllFrames.Any or RelayAllFrames.All'
        );
    });

    test("invokes remote methods using chrome.scripting", async () => {
        const relay = createProxyRelay<RelayProxyType>(options, 1).get();

        expect(await relay.sum(1, 2)).toBe(3);

        expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);

        expectScriptInjection({
            target: {tabId: 1},
            func: expect.any(Function),
            args: [relayName, "sum", [1, 2], RelayGlobalKey, true],
        });
    });

    test("accesses primitive value as method on the relay object", async () => {
        const relay = createProxyRelay<RelayProxyType>(options, {
            tabId: 1,
            frameId: 2,
        }).get();

        expect(await relay.one()).toBe(1);
        expectScriptInjection({
            target: {tabId: 1, frameIds: [2]},
            func: expect.any(Function),
            args: [relayName, "one", [], RelayGlobalKey, true],
        });
    });

    test("maps a scalar document target to Inject Script", async () => {
        const relay = createProxyRelay<RelayProxyType>(options, {
            tabId: 1,
            documentId: "document-2",
        }).get();

        expect(await relay.one()).toBe(1);
        expectScriptInjection({
            target: {tabId: 1, documentIds: ["document-2"]},
            func: expect.any(Function),
            args: [relayName, "one", [], RelayGlobalKey, true],
        });
    });

    test("accesses nested method or property ", async () => {
        const relay = createProxyRelay<RelayProxyType>(options, 1).get();

        expect(await relay.obj.concat("Hello", "world")).toBe("Hello world");
        expectScriptInjection({
            target: {tabId: 1},
            func: expect.any(Function),
            args: [relayName, "obj.concat", ["Hello", "world"], RelayGlobalKey, true],
        });

        expect(await relay.obj.zero()).toBe(0);
        expectScriptInjection({
            target: {tabId: 1},
            func: expect.any(Function),
            args: [relayName, "obj.zero", [], RelayGlobalKey, true],
        });
    });

    test("calls async method on proxy and returns resolved value", async () => {
        const relay = createProxyRelay<RelayProxyType>(options, 1).get();

        expect(await relay.asyncSum(1, 2)).toBe(3);
    });

    test("starts a Scripting relay method before returning control to the caller", async () => {
        const relay = createProxyRelay<RelayProxyType>(options, 1).get();

        const result = relay.activation();
        activationOrder.push("caller");

        expect(activationOrder).toEqual(["relay", "caller"]);
        await expect(result).resolves.toBe(true);
    });

    test("returns fulfilled outcomes from every frame selected by Scripting", async () => {
        const relay = createProxyRelay<RelayBatchProxyType>(options, {
            tabId: 1,
            frameIds: [2, 0],
        }).get();

        await expect(relay.sum(1, 2)).resolves.toEqual([
            {target: {tabId: 1, frameId: 0, documentId: "document-0"}, status: "fulfilled", result: 3},
            {target: {tabId: 1, frameId: 2, documentId: "document-2"}, status: "fulfilled", result: 3},
        ]);

        expectScriptTargets([
            {tabId: 1, frameIds: [2]},
            {tabId: 1, frameIds: [0]},
        ]);
    });

    test("returns addressed outcomes for documentIds selected by Scripting", async () => {
        const relay = createProxyRelay<RelayBatchProxyType>(options, {
            tabId: 1,
            documentIds: ["document-2", "document-0"],
        }).get();

        await expect(relay.sum(1, 2)).resolves.toEqual([
            {
                target: {tabId: 1, frameId: 0, documentId: "document-0"},
                status: "fulfilled",
                result: 3,
            },
            {
                target: {tabId: 1, frameId: 2, documentId: "document-2"},
                status: "fulfilled",
                result: 3,
            },
        ]);

        expectScriptTargets([
            {tabId: 1, documentIds: ["document-2"]},
            {tabId: 1, documentIds: ["document-0"]},
        ]);
    });

    test("normalizes an unobservable Scripting frame outcome", async () => {
        (chrome.scripting.executeScript as jest.Mock).mockImplementationOnce(async () => [{frameId: 0}]);
        const relay = createProxyRelay<RelayBatchProxyType>(options, {
            tabId: 1,
            frameIds: [0],
        }).get();

        await expect(relay.sum(1, 2)).resolves.toEqual([
            {
                target: {tabId: 1, frameId: 0},
                status: "rejected",
                error: expect.objectContaining({
                    kind: RelayFrameErrorKind.Unobservable,
                    message: "The browser did not expose an observable injected function result.",
                }),
            },
        ]);
    });

    test("keeps a target-gone failure isolated in an explicit Scripting batch", async () => {
        (chrome.scripting.executeScript as jest.Mock)
            .mockImplementationOnce(async injection => [
                {
                    frameId: 0,
                    result: await injection.func(...injection.args),
                },
            ])
            .mockImplementationOnce(async () => {
                throw new Error("No frame with id 2 in tab 1");
            });
        const relay = createProxyRelay<RelayBatchProxyType>(options, {
            tabId: 1,
            frameIds: [0, 2],
        }).get();

        await expect(relay.sum(1, 2)).resolves.toEqual([
            {target: {tabId: 1, frameId: 0}, status: "fulfilled", result: 3},
            {
                target: {tabId: 1, frameId: 2},
                status: "rejected",
                error: expect.objectContaining({
                    kind: RelayFrameErrorKind.TargetGone,
                    message: "No frame with id 2 in tab 1",
                }),
            },
        ]);
    });

    test.each([true, RelayAllFrames.Any] as const)(
        "returns one operation outcome for Scripting allFrames %s",
        async allFrames => {
            const relay = createProxyRelay<RelayBatchProxyType>(options, {
                tabId: 1,
                allFrames,
            }).get();

            await expect(relay.fail()).resolves.toEqual([
                {
                    target: {tabId: 1, allFrames: RelayAllFrames.Any},
                    status: "rejected",
                    error: expect.objectContaining({
                        kind: RelayFrameErrorKind.Remote,
                        name: "TypeError",
                        message: "Remote failure",
                    }),
                },
            ]);

            expectScriptInjection({target: {tabId: 1, allFrames: true}});
            expect(mockedGetAllFrames).not.toHaveBeenCalled();
        }
    );

    test.each([true, RelayAllFrames.Any] as const)(
        "returns a fulfilled Scripting outcome for allFrames %s when another frame is rejected",
        async allFrames => {
            (chrome.scripting.executeScript as jest.Mock).mockResolvedValueOnce([
                {frameId: 0, error: new Error("Relay manager not found.")},
                {frameId: 2, result: {ok: true, hasResult: true, result: 3}},
            ]);
            const relay = createProxyRelay<RelayBatchProxyType>(options, {
                tabId: 1,
                allFrames,
            }).get();

            await expect(relay.sum(1, 2)).resolves.toEqual([
                {
                    target: {tabId: 1, allFrames: RelayAllFrames.Any},
                    status: "fulfilled",
                    result: 3,
                },
            ]);
        }
    );

    test.each([true, RelayAllFrames.Any] as const)(
        "does not retry a missing Relay manager for Scripting allFrames %s",
        async allFrames => {
            (chrome.scripting.executeScript as jest.Mock).mockImplementationOnce(async injection => {
                const injectedArgs = [...injection.args];
                injectedArgs[3] = `${RelayGlobalKey}Missing`;
                const setTimeoutSpy = jest.spyOn(globalThis, "setTimeout");
                const execution = injection.func(...injectedArgs);

                expect(injectedArgs.at(-1)).toBe(false);
                expect(setTimeoutSpy).not.toHaveBeenCalled();
                setTimeoutSpy.mockRestore();

                const error = await execution.catch((error: unknown) => error);

                return [{frameId: 0, error}];
            });
            const relay = createProxyRelay<RelayBatchProxyType>(options, {
                tabId: 1,
                allFrames,
            }).get();

            await expect(relay.sum(1, 2)).resolves.toEqual([
                {
                    target: {tabId: 1, allFrames: RelayAllFrames.Any},
                    status: "rejected",
                    error: expect.objectContaining({
                        kind: RelayFrameErrorKind.Execution,
                        message: "Relay manager not found.",
                    }),
                },
            ]);
        }
    );

    test("keeps manager retries for addressed Scripting calls", async () => {
        (chrome.scripting.executeScript as jest.Mock).mockImplementationOnce(async injection => {
            const injectedArgs = [...injection.args];
            injectedArgs[3] = `${RelayGlobalKey}Missing`;
            const setTimeoutSpy = jest
                .spyOn(globalThis, "setTimeout")
                .mockImplementation(() => 0 as unknown as ReturnType<typeof setTimeout>);

            injection.func(...injectedArgs);

            expect(injectedArgs.at(-1)).toBe(true);
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 300);
            setTimeoutSpy.mockRestore();

            return [{frameId: 0, error: new Error("Relay manager not found.")}];
        });
        const relay = createProxyRelay<RelayProxyType>(options, {tabId: 1, frameId: 0}).get();

        await expect(relay.sum(1, 2)).rejects.toThrow("Relay manager not found.");
    });

    test("returns every Scripting outcome for RelayAllFrames.All", async () => {
        const relay = createProxyRelay<RelayBatchProxyType>(options, {
            tabId: 1,
            allFrames: RelayAllFrames.All,
        }).get();

        await expect(relay.fail()).resolves.toEqual([
            {
                target: {tabId: 1, frameId: 0, documentId: "document-0"},
                status: "rejected",
                error: expect.objectContaining({
                    kind: RelayFrameErrorKind.Remote,
                    name: "TypeError",
                    message: "Remote failure",
                }),
            },
            {
                target: {tabId: 1, frameId: 2, documentId: "document-2"},
                status: "rejected",
                error: expect.objectContaining({
                    kind: RelayFrameErrorKind.Remote,
                    name: "TypeError",
                    message: "Remote failure",
                }),
            },
        ]);

        expectScriptInjection({target: {tabId: 1, allFrames: true}});
        expect(mockedGetAllFrames).not.toHaveBeenCalled();
    });

    test("checks Relay permission once for a batch call", async () => {
        const permission = {
            allow: jest.fn().mockReturnValue(true),
            request: jest.fn(),
        };
        relayPermission = permission as unknown as RelayPermission;

        const relay = createProxyRelay<RelayBatchProxyType>(options, {
            tabId: 1,
            allFrames: true,
        }).get();

        await relay.sum(1, 2);

        expect(permission.allow).toHaveBeenCalledTimes(1);
        expect(permission.request).not.toHaveBeenCalled();
    });

    test("fans Messaging calls out to explicit frameIds and keeps partial failures", async () => {
        const send = jest.spyOn(TransportMessage.prototype, "send").mockImplementation(async (_data, target) => {
            const frameId = typeof target === "object" ? target.frameId : undefined;

            if (frameId === 2) {
                throw new Error("Frame with ID 2 was removed");
            }

            return frameId;
        });
        const relay = createProxyRelay<RelayBatchProxyType>(
            {...options, method: RelayMethod.Messaging},
            {tabId: 1, frameIds: [2, 0]}
        ).get();

        await expect(relay.sum(1, 2)).resolves.toEqual([
            {target: {tabId: 1, frameId: 0}, status: "fulfilled", result: 0},
            {
                target: {tabId: 1, frameId: 2},
                status: "rejected",
                error: expect.objectContaining({
                    kind: RelayFrameErrorKind.TargetGone,
                    message: "Frame with ID 2 was removed",
                }),
            },
        ]);

        expect(send).toHaveBeenCalledTimes(2);
        send.mockRestore();
    });

    test("returns a per-frame timeout from Messaging", async () => {
        const send = jest.spyOn(TransportMessage.prototype, "send").mockImplementation(() => new Promise(() => {}));
        const relay = createProxyRelay<RelayBatchProxyType>(
            {...options, method: RelayMethod.Messaging},
            {tabId: 1, frameIds: [2], timeoutMs: 5}
        ).get();

        await expect(relay.sum(1, 2)).resolves.toEqual([
            {
                target: {tabId: 1, frameId: 2},
                status: "rejected",
                error: expect.objectContaining({
                    kind: RelayFrameErrorKind.Timeout,
                    name: "RelayFrameTimeoutError",
                }),
            },
        ]);

        send.mockRestore();
    });

    test("passes timeoutMs to Inject Script", async () => {
        (chrome.scripting.executeScript as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));
        const relay = createProxyRelay<RelayBatchProxyType>(options, {
            tabId: 1,
            frameIds: [0],
            timeoutMs: 5,
        }).get();

        await expect(relay.sum(1, 2)).resolves.toEqual([
            {
                target: {tabId: 1, frameId: 0},
                status: "rejected",
                error: expect.objectContaining({
                    kind: RelayFrameErrorKind.Timeout,
                    message: "Script execution timed out after 5 ms.",
                }),
            },
        ]);
    });

    test("classifies restored remote Messaging errors structurally", async () => {
        const send = jest
            .spyOn(TransportMessage.prototype, "send")
            .mockRejectedValue(markRemoteMessageError(new TypeError("Remote failure")));
        const relay = createProxyRelay<RelayBatchProxyType>(
            {...options, method: RelayMethod.Messaging},
            {tabId: 1, frameIds: [0]}
        ).get();

        await expect(relay.fail()).resolves.toEqual([
            {
                target: {tabId: 1, frameId: 0},
                status: "rejected",
                error: expect.objectContaining({
                    kind: RelayFrameErrorKind.Remote,
                    name: "TypeError",
                    message: "Remote failure",
                }),
            },
        ]);

        send.mockRestore();
    });

    test.each([true, RelayAllFrames.Any] as const)(
        "returns one native Messaging outcome for allFrames %s without discovery",
        async allFrames => {
            const send = jest.spyOn(TransportMessage.prototype, "send").mockResolvedValue(3);
            const relay = createProxyRelay<RelayBatchProxyType>(
                {...options, method: RelayMethod.Messaging},
                {tabId: 1, allFrames}
            ).get();

            await expect(relay.sum(1, 2)).resolves.toEqual([
                {
                    target: {tabId: 1, allFrames: RelayAllFrames.Any},
                    status: "fulfilled",
                    result: 3,
                },
            ]);

            expect(mockedGetAllFrames).not.toHaveBeenCalled();
            expect(send).toHaveBeenCalledWith({path: "sum", args: [1, 2]}, {tabId: 1});
            send.mockRestore();
        }
    );

    test("keeps allFrames false on the scalar top-frame contract", async () => {
        const send = jest.spyOn(TransportMessage.prototype, "send").mockResolvedValue(3);
        const relay = createProxyRelay<RelayProxyType>(
            {...options, method: RelayMethod.Messaging},
            {tabId: 1, allFrames: false}
        ).get();

        await expect(relay.sum(1, 2)).resolves.toBe(3);

        expect(mockedGetAllFrames).not.toHaveBeenCalled();
        expect(send).toHaveBeenCalledWith({path: "sum", args: [1, 2]}, {tabId: 1, frameId: 0});
        send.mockRestore();
    });

    test("discovers strict Messaging allFrames targets through webNavigation", async () => {
        mockedGetManifest.mockReturnValue({...manifest, permissions: ["webNavigation"]});
        const topFrame: chrome.webNavigation.GetAllFrameResultDetails = {
            frameId: 0,
            documentId: "document-0",
            documentLifecycle: "active",
            frameType: "outermost_frame",
            parentFrameId: -1,
            processId: 1,
            errorOccurred: false,
            url: "https://example.com/",
        };
        const childFrame: chrome.webNavigation.GetAllFrameResultDetails = {
            ...topFrame,
            frameId: 3,
            documentId: "document-3",
            frameType: "sub_frame",
            parentFrameId: 0,
            parentDocumentId: "document-0",
            url: "https://example.com/frame",
        };
        mockedGetAllFrames.mockResolvedValue([childFrame, topFrame]);
        const send = jest.spyOn(TransportMessage.prototype, "send").mockImplementation(async (_data, target) => {
            return typeof target === "object" ? target.frameId : undefined;
        });
        const relay = createProxyRelay<RelayBatchProxyType>(
            {...options, method: RelayMethod.Messaging},
            {tabId: 1, allFrames: RelayAllFrames.All}
        ).get();

        await expect(relay.sum(1, 2)).resolves.toEqual([
            {
                target: {tabId: 1, frameId: 0, documentId: "document-0"},
                status: "fulfilled",
                result: 0,
            },
            {
                target: {tabId: 1, frameId: 3, documentId: "document-3"},
                status: "fulfilled",
                result: 3,
            },
        ]);

        expect(mockedGetAllFrames).toHaveBeenCalledWith(1);
        expect(send).toHaveBeenNthCalledWith(
            1,
            {path: "sum", args: [1, 2]},
            {tabId: 1, frameId: 0, documentId: "document-0"}
        );
        expect(send).toHaveBeenNthCalledWith(
            2,
            {path: "sum", args: [1, 2]},
            {tabId: 1, frameId: 3, documentId: "document-3"}
        );
        send.mockRestore();
    });
});

describe("RegisterRelay", () => {
    beforeEach(async () => {
        (isRelayContext as jest.Mock).mockReturnValue(true);
    });

    test("throws if trying to get registered relay from non-content script", async () => {
        (isRelayContext as jest.Mock).mockReturnValue(false);

        const proxy = new RegisterRelay(relayName, RelayMethod.Scripting, () => MatchRelay);

        expect(() => proxy.get()).toThrow(`Relay "${relayName}" can be getting only from content script`);
    });

    test("returns real relay when called in content script context", () => {
        const relay = new RegisterRelay<typeof relayName, RelayType>(
            relayName,
            RelayMethod.Scripting,
            () => MatchRelay
        ).get();

        expect(relay["__proxy"]).toBe(undefined);
    });

    test("calls method directly in content script without chrome.scripting", async () => {
        const relay = new RegisterRelay<typeof relayName, RelayType>(
            relayName,
            RelayMethod.Scripting,
            () => MatchRelay
        ).get();

        expect(relay.sum(1, 2)).toBe(3);
        expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(0);
    });

    test("throws an error when attempting to register the same relay twice", async () => {
        const relay = new RegisterRelay<typeof relayName, RelayType>(
            relayName,
            RelayMethod.Scripting,
            () => MatchRelay
        );

        expect(() => relay.register()).toThrow(
            `A relay with the name "${relayName}" already exists. The relay name must be unique.`
        );
    });

    test("does not call parent register method when RelayMethod is 'scripting'", () => {
        const registerRelay = new RegisterRelay(relayName, RelayMethod.Scripting, () => MatchRelay);
        const parentRegisterSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(registerRelay)), "register");
        jest.spyOn(RelayManager.getInstance(), "has").mockReturnValue(false);

        registerRelay.register();

        expect(parentRegisterSpy).not.toHaveBeenCalled();

        parentRegisterSpy.mockRestore();
    });

    test("calls parent register method when method is 'messaging'", () => {
        const registerRelay = new RegisterRelay(relayName, RelayMethod.Messaging, () => MatchRelay);
        const parentRegisterSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(registerRelay)), "register");
        parentRegisterSpy.mockReturnValue(MatchRelay);

        const result = registerRelay.register();

        expect(result).toBe(MatchRelay);
        expect(parentRegisterSpy).toHaveBeenCalledWith();

        parentRegisterSpy.mockRestore();
    });
});
