import * as api from "adnbn";
import * as local from "adnbn/relay";
import * as entry from "adnbn/entry/relay";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

const definition = api.defineRelay({
    name: "scanner",
    allFrames: api.RelayAllFrames.All,
    method: api.RelayMethod.Scripting,
    init: () => ({scan: (text: string) => text.length}),
});

new entry.Builder(definition);
const unresolved: entry.RelayUnresolvedDefinition<ReturnType<typeof definition.init>> = {};
new entry.Builder(unresolved);

const original = local.getRelay("scanner");
const scalar = api.getRelay("scanner", 1);
const top = api.getRelay("scanner", {tabId: 1});
const single = api.getRelay("scanner", {tabId: 1, allFrames: false});
const frame = api.getRelay("scanner", {tabId: 1, frameId: 2});
const document = api.getRelay("scanner", {tabId: 1, documentId: "document-2"});
const broadcast = api.getRelay("scanner", {tabId: 1, allFrames: true});
const any = api.getRelay("scanner", {tabId: 1, allFrames: api.RelayAllFrames.Any});
const all = api.getRelay("scanner", {tabId: 1, allFrames: api.RelayAllFrames.All});
const frames = api.getRelay("scanner", {tabId: 1, frameIds: [0, 2]});
const documents = api.getRelay("scanner", {tabId: 1, documentIds: ["document-2"]});

type LocalResult = Expect<Equal<ReturnType<typeof original.scan>, number>>;
type ScalarResult = Expect<Equal<ReturnType<typeof scalar.scan>, Promise<number>>>;
type TopResult = Expect<Equal<typeof top, typeof scalar>>;
type SingleResult = Expect<Equal<typeof single, typeof scalar>>;
type FrameResult = Expect<Equal<typeof frame, typeof scalar>>;
type DocumentResult = Expect<Equal<typeof document, typeof scalar>>;
type AnyResult = Expect<Equal<ReturnType<typeof any.scan>, Promise<api.RelayFramesResult<number>>>>;
type AllResult = Expect<Equal<typeof all, typeof any>>;
type BroadcastResult = Expect<Equal<typeof broadcast, typeof any>>;
type FramesResult = Expect<Equal<typeof frames, typeof any>>;
type DocumentsResult = Expect<Equal<typeof documents, typeof any>>;
type AsyncScalarResult = Expect<Equal<ReturnType<typeof scalar.load>, Promise<string>>>;
type AsyncBatchResult = Expect<Equal<ReturnType<typeof all.load>, Promise<api.RelayFramesResult<string>>>>;
type NestedScalarResult = Expect<Equal<ReturnType<typeof scalar.nested.ready>, Promise<boolean>>>;
type NestedBatchResult = Expect<Equal<ReturnType<typeof all.nested.ready>, Promise<api.RelayFramesResult<boolean>>>>;
type PropertyResult = Expect<Equal<ReturnType<typeof all.nested.count>, Promise<api.RelayFramesResult<number>>>>;
type NestedObjectResult = Expect<
    Equal<ReturnType<typeof all.nested>, Promise<api.RelayFramesResult<local.RelayRegistry["scanner"]["nested"]>>>
>;
type ScalarAlias = Expect<Equal<typeof scalar, api.RelayProxyTarget<"scanner">>>;
type BatchAlias = Expect<Equal<typeof all, api.RelayBatchProxyTarget<"scanner">>>;
type LocalAlias = Expect<Equal<typeof original, local.RelayTarget<"scanner">>>;
type Names = Expect<Equal<local.RelayName, "scanner">>;

scalar.scan("text");
all.scan("text");

// @ts-expect-error: The generated registry restricts names in the remote accessor.
api.getRelay("unknown", 1);
// @ts-expect-error: The local accessor uses the same generated registry.
local.getRelay("unknown");
// @ts-expect-error: A remote call needs a tab target.
api.getRelay("scanner");
// @ts-expect-error: A local accessor does not accept a remote target.
local.getRelay("scanner", 1);
// @ts-expect-error: Selectors are mutually exclusive.
api.getRelay("scanner", {tabId: 1, frameId: 2, allFrames: api.RelayAllFrames.All});
// @ts-expect-error: Frame and document targeting cannot be combined.
api.getRelay("scanner", {tabId: 1, frameId: 2, documentId: "document-2"});
// @ts-expect-error: Explicit frame lists are non-empty.
api.getRelay("scanner", {tabId: 1, frameIds: []});
// @ts-expect-error: Explicit document lists are non-empty.
api.getRelay("scanner", {tabId: 1, documentIds: []});
// @ts-expect-error: Scalar method arguments retain their original types.
scalar.scan(1);
// @ts-expect-error: Batch method arguments retain their original types.
all.scan(1);

// @ts-expect-error: Unresolved definitions belong to the internal entry/bootstrap module.
type InternalDefinition = api.RelayUnresolvedDefinition<object>;
// @ts-expect-error: Remote call options are not exported from the local-access module.
type LocalCallOptions = local.RelayCallOptions;
// @ts-expect-error: Provider implementation details are not a public entrypoint.
type InternalParams = local.ProxyRelayParams;

export {api, local, entry};
