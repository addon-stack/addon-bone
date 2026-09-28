import {getBrowserTest} from "@tests/browser-harness/session";
import {RelayProtocolError} from "@main/relay";
import {RelayAllFrames, RelayFrameErrorKind} from "@typing/relay";
import RelayScriptingAdapter from "./RelayScriptingAdapter";
import {createRelayRuntime} from "../tests/runtime";

test.each([true, RelayAllFrames.Any] as const)(
    "envelopes an absent manager immediately for any-frame calls %s",
    async allFrames => {
        const runtime = createRelayRuntime(false);
        const adapter = new RelayScriptingAdapter("math", {tabId: 1, allFrames});

        await expect(adapter.invoke([], "empty")).resolves.toEqual([
            expect.objectContaining({
                status: "rejected",
                error: expect.objectContaining({kind: RelayFrameErrorKind.Remote, message: "Relay manager not found."}),
            }),
        ]);
        expect(runtime.clock!.now).toBe(0);
        expect(runtime.pendingExecutions).toBe(0);
    }
);

test("makes the tenth manager lookup at 2700ms, not 2699ms", async () => {
    const runtime = createRelayRuntime(false);
    const adapter = new RelayScriptingAdapter("math", {tabId: 1, frameId: 0});
    const result = adapter.invoke([], "empty");
    const rejected = expect(result).rejects.toThrow("Relay manager not found after 10 attempts.");

    runtime.clock!.advance(2699);
    expect(runtime.pendingExecutions).toBe(1);
    runtime.clock!.advance(1);
    await rejected;
});

test("uses a real manager registered before the final lookup", async () => {
    const runtime = createRelayRuntime(false);
    const adapter = new RelayScriptingAdapter("math", {tabId: 1, frameId: 0});
    const result = adapter.invoke([1, 2], "sum");

    runtime.clock!.advance(2699);
    runtime.evaluate({documentId: "document-0"}, {source: "relayFixture.register();"});
    runtime.clock!.advance(1);
    await expect(result).resolves.toBe(3);
});

test.each([
    null,
    false,
    7,
    "wrong",
    [],
    {},
    {ok: true},
    {ok: true, hasResult: true},
    {ok: false},
    {ok: false, error: {name: 7, message: "bad"}},
])("rejects malformed injection envelopes: %p", async value => {
    getBrowserTest().harness.scripting.executeScript.setResult([{frameId: 0, documentId: "document-0", result: value}]);
    const adapter = new RelayScriptingAdapter("math", {tabId: 1});
    const result = adapter.invoke([]);

    await expect(result).rejects.toBeInstanceOf(RelayProtocolError);
    await expect(result).rejects.toThrow('Relay "math" returned an invalid scripting response envelope.');
});

test("does not turn a remote error with the same name into a local protocol error", async () => {
    getBrowserTest().harness.scripting.executeScript.setResult([
        {
            frameId: 0,
            documentId: "document-0",
            result: {ok: false, error: {name: "RelayProtocolError", message: "From the remote handler"}},
        },
    ]);
    const adapter = new RelayScriptingAdapter("math", {tabId: 1});
    const result = adapter.invoke([]);

    await expect(result).rejects.toBeInstanceOf(Error);
    await expect(result).rejects.not.toBeInstanceOf(RelayProtocolError);
    await expect(result).rejects.toMatchObject({name: "RelayProtocolError", message: "From the remote handler"});
});

test.each(["empty", "nullable"])("preserves a successful %s result across serialization", async method => {
    createRelayRuntime();
    const adapter = new RelayScriptingAdapter("math", {tabId: 1, frameId: 0});

    await expect(adapter.invoke([], method)).resolves.toBe(method === "empty" ? undefined : null);
});

test.each(["fail", "reject"])("preserves remote error details from %s", async method => {
    createRelayRuntime();
    const adapter = new RelayScriptingAdapter("math", {tabId: 1, frameId: 0});

    await expect(adapter.invoke([], method)).rejects.toMatchObject({
        name: method === "fail" ? "TypeError" : "RangeError",
        message: method === "fail" ? "Remote failure" : "Async failure",
    });
});

test("isolates malformed responses within a batch", async () => {
    getBrowserTest().harness.scripting.executeScript.queueResult(
        [{frameId: 2, documentId: "document-2", result: null}],
        [{frameId: 0, documentId: "document-0", result: {ok: true, hasResult: false}}]
    );
    const adapter = new RelayScriptingAdapter("math", {tabId: 1, frameIds: [2, 0]});

    await expect(adapter.invoke([])).resolves.toEqual([
        {target: {tabId: 1, frameId: 0, documentId: "document-0"}, status: "fulfilled", result: undefined},
        {
            target: {tabId: 1, frameId: 2, documentId: "document-2"},
            status: "rejected",
            error: expect.objectContaining({
                kind: RelayFrameErrorKind.Execution,
                name: "RelayProtocolError",
            }),
        },
    ]);
});

test.each([true, RelayAllFrames.Any] as const)(
    "selects a valid response despite a malformed sibling with allFrames %s",
    async allFrames => {
        getBrowserTest().harness.scripting.executeScript.setResult([
            {frameId: 0, documentId: "document-0", result: null},
            {frameId: 2, documentId: "document-2", result: {ok: true, hasResult: true, result: 42}},
        ]);
        const adapter = new RelayScriptingAdapter("math", {tabId: 1, allFrames});

        await expect(adapter.invoke([])).resolves.toEqual([
            {target: {tabId: 1, allFrames: RelayAllFrames.Any}, status: "fulfilled", result: 42},
        ]);
    }
);

test.each(["document", "runtime"])("rejects pending execution when its %s is removed", async owner => {
    const runtime = createRelayRuntime();
    const adapter = new RelayScriptingAdapter("math", {tabId: 1, frameId: 0});
    const rejected = expect(adapter.invoke([1, 2], "asyncSum")).rejects.toThrow(/removed|disposed|cancel/i);

    expect(runtime.pendingExecutions).toBe(1);

    if (owner === "document") {
        getBrowserTest().harness.contexts.documents.remove("document-0");
    } else {
        runtime.dispose();
    }

    await rejected;
    expect(runtime.pendingExecutions).toBe(0);
});
