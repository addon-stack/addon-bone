import {getManifest} from "@addon-core/browser";

import {getBrowserTest} from "@tests/browser-harness/session";
import type {NodeScriptRuntime} from "@addon-core/browser/testing/node";
import {createRelayRuntime} from "../tests/runtime";
import type {RelayFixture} from "../tests/fixtures/runtime";
import {MessageResultEnvelopeProperty, type MessageSendOptions} from "@typing/message";
import type {TransportMessageData} from "@typing/transport";

import ProxyRelay, {type ProxyRelayParams} from "./ProxyRelay";

import RelayManager from "../RelayManager";
import RelayPermission from "../RelayPermission";

import {
    RelayAllFrames,
    RelayBatchRpcProxy,
    RelayFrameErrorKind,
    RelayGlobalKey,
    RelayMethod,
    RelayOptions,
} from "@typing/relay";
import {RpcAsyncProxy} from "@typing/rpc";

const scripting = () => getBrowserTest().harness.scripting.executeScript;
const messaging = () => {
    const {harness, context} = getBrowserTest();

    return harness.messaging.forContext(context).tabs.sendMessage;
};
const frames = () => getBrowserTest().harness.configurable.chrome.webNavigation.getAllFrames;
let runtime: NodeScriptRuntime;
let relayPermission: RelayPermission;

const manifest = {manifest_version: 3, name: "Relay test", version: "1.0.0"} satisfies ReturnType<typeof getManifest>;

beforeEach(() => {
    runtime = createRelayRuntime();
    getBrowserTest().harness.runtime.setManifest({...manifest, permissions: []});
    getBrowserTest().harness.permissions.contains.setResult(true);
    relayPermission = RelayPermission.getInstance(
        new Map([[relayName, {...options, name: relayName, declarative: true}]])
    );
});

type RelayType = RelayFixture;
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
    expect(scripting().calls.at(-1)?.args[0]).toEqual(expect.objectContaining(expected));
};

const expectScriptTargets = (expected: chrome.scripting.InjectionTarget[]) => {
    expect(
        scripting().calls.map(call => (call.args[0] as chrome.scripting.ScriptInjection<any[], any>).target)
    ).toEqual(expected);
};

const expectMessageCall = (index: number, data: TransportMessageData, target: Exclude<MessageSendOptions, number>) => {
    const {tabId, ...options} = target;

    expect(messaging().calls[index].args).toEqual([tabId, expect.objectContaining({data}), options]);
};

describe("ProxyRelay", () => {
    test("throws an error when get() is called in content script context", async () => {
        RelayManager.getInstance();

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

        expect(scripting().calls).toHaveLength(1);

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

        const result = relay.asyncSum(1, 2);

        runtime.clock!.advance(100);
        expect(await result).toBe(3);
    });

    test("starts a Scripting relay method before returning control to the caller", async () => {
        const relay = createProxyRelay<RelayProxyType>(options, 1).get();

        const result = relay.activation();
        runtime.evaluate(
            {documentId: "document-0"},
            {source: 'if (!relayFixture.started) { throw new Error("Relay method has not started"); }'}
        );
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
        scripting().queueResult([{frameId: 0, documentId: "document-0"}]);
        const relay = createProxyRelay<RelayBatchProxyType>(options, {
            tabId: 1,
            frameIds: [0],
        }).get();

        await expect(relay.sum(1, 2)).resolves.toEqual([
            {
                target: {tabId: 1, frameId: 0, documentId: "document-0"},
                status: "rejected",
                error: expect.objectContaining({
                    kind: RelayFrameErrorKind.Unobservable,
                    message: "The browser did not expose an observable injected function result.",
                }),
            },
        ]);
    });

    test("keeps a target-gone failure isolated in an explicit Scripting batch", async () => {
        scripting().queueResult([
            {frameId: 0, documentId: "document-0", result: {ok: true, hasResult: true, result: 3}},
        ]);
        scripting().failNext(new Error("No frame with id 2 in tab 1"));
        const relay = createProxyRelay<RelayBatchProxyType>(options, {
            tabId: 1,
            frameIds: [2, 0],
        }).get();

        await expect(relay.sum(1, 2)).resolves.toEqual([
            {target: {tabId: 1, frameId: 0, documentId: "document-0"}, status: "fulfilled", result: 3},
            {
                target: {tabId: 1, frameId: 2},
                status: "rejected",
                error: expect.objectContaining({
                    kind: RelayFrameErrorKind.TargetGone,
                    message: expect.stringMatching(/frame.*2/i),
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
            expect(frames().calls).toHaveLength(0);
        }
    );

    test.each([true, RelayAllFrames.Any] as const)(
        "returns a fulfilled Scripting outcome for allFrames %s when another frame is rejected",
        async allFrames => {
            scripting().queueResult([
                {
                    frameId: 0,
                    documentId: "document-0",
                    result: {ok: false, error: {name: "Error", message: "Relay manager not found."}},
                },
                {frameId: 2, documentId: "document-2", result: {ok: true, hasResult: true, result: 3}},
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
        expect(frames().calls).toHaveLength(0);
    });

    test("checks Relay permission once for a batch call", async () => {
        relayPermission.set(relayName, {allow: false});
        getBrowserTest().harness.permissions.request.setResult(true);

        const relay = createProxyRelay<RelayBatchProxyType>(options, {
            tabId: 1,
            allFrames: true,
        }).get();

        await relay.sum(1, 2);

        expect(getBrowserTest().harness.permissions.request.calls).toHaveLength(1);
    });

    test("fans Messaging calls out to explicit frameIds and keeps partial failures", async () => {
        const send = messaging();

        send.failNext(new Error("Frame with ID 2 was removed"));
        send.queueResult({[MessageResultEnvelopeProperty]: true, ok: true, payload: 0});
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

        expect(send.calls).toHaveLength(2);
    });

    test("returns a per-frame timeout from Messaging", async () => {
        const receiver = getBrowserTest().harness.contexts.create({
            kind: "contentScript",
            tabId: 1,
            frameId: 2,
            documentId: "document-2",
            url: "https://example.com/",
        });

        receiver.onMessage.on(() => true);
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
    });

    test("passes timeoutMs to Inject Script", async () => {
        getBrowserTest().harness.contexts.documents.remove("document-0");
        getBrowserTest().harness.contexts.documents.create({
            documentId: "pending",
            tabId: 1,
            url: "https://example.com/",
        });
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
        messaging().setResult({
            [MessageResultEnvelopeProperty]: true,
            ok: false,
            error: {name: "TypeError", message: "Remote failure"},
        });
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
    });

    test.each([true, RelayAllFrames.Any] as const)(
        "returns one native Messaging outcome for allFrames %s without discovery",
        async allFrames => {
            messaging().setResult({[MessageResultEnvelopeProperty]: true, ok: true, payload: 3});
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

            expect(frames().calls).toHaveLength(0);
            expectMessageCall(0, {path: "sum", args: [1, 2]}, {tabId: 1});
        }
    );

    test("keeps allFrames false on the scalar top-frame contract", async () => {
        messaging().setResult({[MessageResultEnvelopeProperty]: true, ok: true, payload: 3});
        const relay = createProxyRelay<RelayProxyType>(
            {...options, method: RelayMethod.Messaging},
            {tabId: 1, allFrames: false}
        ).get();

        await expect(relay.sum(1, 2)).resolves.toBe(3);

        expect(frames().calls).toHaveLength(0);
        expectMessageCall(0, {path: "sum", args: [1, 2]}, {tabId: 1, frameId: 0});
    });

    test("discovers strict Messaging allFrames targets through webNavigation", async () => {
        getBrowserTest().harness.runtime.setManifest({...manifest, permissions: ["webNavigation"]});
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
        frames().setResult([childFrame, topFrame]);
        messaging().queueResult(
            {[MessageResultEnvelopeProperty]: true, ok: true, payload: 0},
            {[MessageResultEnvelopeProperty]: true, ok: true, payload: 3}
        );
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

        expect(frames().calls[0].args).toEqual([{tabId: 1}]);
        expectMessageCall(0, {path: "sum", args: [1, 2]}, {tabId: 1, frameId: 0, documentId: "document-0"});
        expectMessageCall(1, {path: "sum", args: [1, 2]}, {tabId: 1, frameId: 3, documentId: "document-3"});
    });
});
