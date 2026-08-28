# Relay

Relay exposes an object living in a content-script frame as a typed RPC API. Extension contexts such as a popup or background can call its methods, read its data, and receive results without implementing message routing themselves.

This README describes the Relay runtime in this directory and the entrypoint lifecycle in [`src/entry/relay`](../entry/relay). It is a guide for developers and AI agents changing this layer; it documents the current implementation, not proposed APIs.

## Responsibilities and boundaries

- Create and register a named instance in each frame where the Relay entrypoint runs.
- Turn remote method/property access into the shared transport's `{path, args}` calls.
- Address the top frame, a specific frame/document, explicit lists, or all frames in one tab.
- Select Messaging or Scripting and normalize their results into the Relay contract.
- Contribute the required manifest permissions through the content-plugin pipeline.

Relay is not a background service, a multi-tab coordinator, or a mechanism for accessing arbitrary page JavaScript. Each frame has its own instance and state. A call does not install the Relay entrypoint or bypass its matches, host access, execution world, or browser restrictions.

## Quick start

Define a Relay in the extension's source directory:

```ts title="src/relays/scanner.relay.ts"
import {defineRelay, RelayAllFrames, RelayMethod} from "adnbn";

export default defineRelay({
    name: "scanner",
    matches: ["https://example.com/*"],
    method: RelayMethod.Messaging,
    allFrames: RelayAllFrames.All,
    init() {
        return {
            scan() {
                return {
                    url: location.href,
                    title: document.title,
                    links: document.links.length,
                };
            },
        };
    },
});
```

The framework generates the Relay registry/types from the entrypoint's `init` contract. Build or run the extension's watch command to generate them; an empty registry does not know the name `"scanner"`.

```ts title="src/popup/scanTab.ts"
import {getRelay, RelayAllFrames} from "adnbn";

export async function scanTab(tabId: number) {
    const top = await getRelay("scanner", tabId).scan();
    console.log("Top frame", top);

    const outcomes = await getRelay("scanner", {
        tabId,
        allFrames: RelayAllFrames.All,
        timeoutMs: 5_000,
    }).scan();

    for (const outcome of outcomes) {
        if (outcome.status === "fulfilled") {
            console.log(outcome.target, outcome.result);
        } else {
            console.error(outcome.target, outcome.error.kind, outcome.error.message);
        }
    }
}
```

`method` belongs to the entrypoint configuration, not the call target. It defaults to `RelayMethod.Messaging`. To expose separate Messaging and Scripting endpoints, define separate named Relays.

The two `getRelay` imports serve different contexts:

| Import        | Usage                                                                                       | Returned value          |
| ------------- | ------------------------------------------------------------------------------------------- | ----------------------- |
| `adnbn`       | `getRelay(name, target)` from a remote caller                                               | Async RPC proxy         |
| `adnbn/relay` | `getRelay(name)` where that Relay is already registered in the current content-script frame | Original local instance |

The local accessor is not a way to address another frame. The remote accessor rejects use in a context containing the Relay manager; use the local instance there.

### Export ownership

- [`adnbn`](../main/relay.ts) exports `defineRelay`, the remote `getRelay`, and the public definition, call-target, proxy, result, and error contracts. Import `RelayAllFrames`, `RelayMethod`, `RelayFrameErrorKind`, and `RelayDiscoveryError` here.
- [`adnbn/relay`](./index.ts) exports only the local `getRelay` and `RelayRegistry`, `RelayName`, and `RelayTarget` types. The generated `.adnbn/relay.d.ts` augments this registry; both accessors derive their types from it. It does not redeclare accessor overloads.
- [`adnbn/entry/relay`](../entry/relay/index.ts) is the internal bootstrap interface: `Builder`, its default resolver, and `RelayUnresolvedDefinition`. The unresolved type represents a definition assembled by the virtual module, not the public `defineRelay` contract.

`ProxyRelay`, `RegisterRelay`, and `ProxyRelayParams` are internal implementation details, not exports of `adnbn/relay`. Remote call/result types are available from `adnbn`, not the local-access module. There are no legacy export aliases.

## Targets and return types

There is one remote `getRelay` API with scalar and batch overloads. For a method returning `T` or `Promise<T>`:

| Call target                                                                 | Delivery scope                                                     | Return type                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------- |
| `tabId`, `{tabId}`, or `{tabId, allFrames: false}`                          | Top frame (`frameId: 0`)                                           | `Promise<T>`                    |
| `{tabId, frameId: 7}`                                                       | One frame                                                          | `Promise<T>`                    |
| `{tabId, documentId}`                                                       | One document                                                       | `Promise<T>`                    |
| `{tabId, frameIds: [0, 7]}`                                                 | Selected frames                                                    | `Promise<RelayFramesResult<T>>` |
| `{tabId, documentIds: [firstId, secondId]}`                                 | Selected documents                                                 | `Promise<RelayFramesResult<T>>` |
| `{tabId, allFrames: true}` or `RelayAllFrames.Any` as the `allFrames` value | Broadcast/native all-frame injection; one selected outcome         | `Promise<RelayFramesResult<T>>` |
| `{tabId, allFrames: RelayAllFrames.All}`                                    | All discovered Messaging targets / all observed Scripting outcomes | `Promise<RelayFramesResult<T>>` |

`true` is an alias for `Any`, **not** `All`. Even a one-element `frameIds` or `documentIds` list uses the batch contract.

The selectors `allFrames`, `frameId`, `frameIds`, `documentId`, and `documentIds` are mutually exclusive. This includes combining `allFrames: false` with another selector. Both TypeScript and runtime validation enforce the contract. IDs must be valid non-negative integers or non-empty document strings; lists must be non-empty and contain no duplicates. `timeoutMs`, when provided, must be finite and greater than zero.

Use a literal target or narrow a runtime choice before calling `getRelay`; do not hide an ambiguous scalar/batch choice behind `any`. Reusable ID lists can use the exported `RelayNonEmptyReadonlyArray<T>` type.

Proxy methods always return promises. Nested paths are supported, and primitive properties are read by calling them: a local `version: 1` becomes `await proxy.version()`. Scalar proxy typing is shared [`RpcAsyncProxy`](../types/rpc.ts); batch typing is Relay-specific [`RelayBatchRpcProxy`](../types/relay.ts).

### Batch outcomes

`RelayFramesResult<T>` is a readonly array, not a map keyed by browser objects. Each element has one of these shapes:

```ts title="Relay outcome shapes"
import type {RelayFrameError, RelayResultTarget} from "adnbn";

type Outcome<T> =
    | {target: RelayResultTarget; status: "fulfilled"; result: T}
    | {target: RelayResultTarget; status: "rejected"; error: RelayFrameError};
```

- Addressed outcomes carry `{tabId, frameId, documentId?}` or `{tabId, documentId}`. An output may contain both frame and document IDs even though input selectors are exclusive.
- `Any` uses `{tabId, allFrames: RelayAllFrames.Any}`. It does not claim to identify the responding frame, even when Scripting knew the selected frame internally.
- An unaddressable Scripting `All` failure can use `{tabId, allFrames: RelayAllFrames.All}`. Never manufacture `frameId: 0` for an operation-wide error.
- Addressed results are sorted by frame ID, then document ID; do not interpret array order as response timing or requested-list order.

### `Any`: execute everywhere, observe one outcome

**`Any` can execute a mutating method in multiple frames even though it returns only one outcome. It does not choose one frame to execute.**

Messaging sends one native tab message without a frame/document selector. Every matching listener receives it, but only the first response is observable. That response can be a remote error; there is no preference for success and no guarantee that frame `0` answers. This follows [native tab messaging](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-sendMessage) and [first-response handling](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#responses).

Scripting performs native all-frame injection, normalizes/sorts the returned outcomes, and selects the first fulfilled outcome, falling back to the first rejected one. It waits for the injection operation; this is **not** a race that resolves immediately when one frame succeeds. A slow method in another frame can still delay it. If the injector returns no outcomes, Relay returns `[]`.

Use `Any` for a broadcast signal when a complete report is unnecessary. It still returns an outcome array, not `void`, and is not a delivery receipt for every frame. If the caller ignores the result, it must still handle possible call-level rejection. Use idempotent operations or application-level request IDs when repeated side effects matter.

### `All`: inspect every available outcome

- **Messaging:** discover a snapshot of frame addresses, then send an independently addressed call to each. Frames without a Relay listener are not filtered out; their delivery failures are reported.
- **Scripting:** use native `allFrames: true` and return all outcomes exposed by Inject Script. This is not an independently enumerated inventory of every frame in the tab. Inaccessible or unobservable execution may produce an operation-level failure rather than an address for every missing frame.

Neither mode freezes the page: frames can navigate, disappear, or appear after dispatch. For an explicitly known set, use `frameIds` or `documentIds`. Both transports isolate ordinary target-level failures for explicit lists; Inject Script starts separate native calls for the selected targets.

## Configuration and permissions

### Entrypoint coverage is not the call target

`defineRelay({allFrames: ...})` controls content-script coverage and build-time permission requirements. `getRelay(name, {allFrames: ...})` controls delivery and return type for that call. One does not replace or implicitly set the other.

The Relay driver converts entrypoint `true`, `Any`, and `All` to the content-script boolean `allFrames: true`. The virtual Relay module applies the same conversion when constructing the runtime content builder, without passing Relay's `method` option to it. `false` remains false, and an omitted value remains omitted. The regular `ContentScriptEntrypointOptions.allFrames` type stays boolean; only Relay replaces it with its own type. Relay's own builder retains the original mode.

An all-frame call cannot make a top-frame-only entrypoint appear inside an iframe. Each frame must still satisfy registration and access requirements.

### Permission contributions

| Entrypoint configuration                                               | Relay-specific manifest contribution |
| ---------------------------------------------------------------------- | ------------------------------------ |
| Messaging + `allFrames: RelayAllFrames.All`                            | Required `webNavigation`             |
| Messaging + omitted/false/true/`Any`                                   | No frame-discovery permission        |
| Scripting + `declarative: true` or `ContentScriptDeclarative.Required` | Required `scripting`                 |
| Scripting + `ContentScriptDeclarative.Optional`                        | Optional `scripting`                 |

Scripting defaults to optional declarative registration when `declarative` is omitted. `declarative: false` is not a supported Scripting configuration. Scripting does not require `webNavigation` for any target mode. Host and optional host permissions are handled through the existing content-script configuration; this table does not replace them.

The build cannot infer future call-site targets. If a Messaging Relay is configured with `Any` but a caller requests `All`, the manifest must already contain required `webNavigation`, either from another entrypoint or explicit framework configuration. There is no separate `frameDiscoveryFallback` flag, and optional-only `webNavigation` is not sufficient for the current discovery guard.

Permission ownership follows this path:

```text
RelayParser / RelayFinder
    -> RelayDriver: Relay-specific permission rules using original Relay options
    -> ContentManager: aggregate content and Relay driver contributions
    -> manifest: required / optional permissions and host permissions
```

[`RelayDriver`](../cli/plugins/content/RelayDriver.ts) retains the original options for permission calculation because its content transformation removes `method`/`name` and reduces `allFrames` to a boolean. [`ContentManager`](../cli/plugins/content/ContentManager.ts) must remain unaware of Relay enums. Drivers and the manager expose separate `permissions()` and `optionalPermissions()` methods; required API permissions take precedence over optional duplicates.

### Runtime permission gate

[`RelayPermission`](./RelayPermission.ts) caches permission state for configured Relays in the calling runtime context. `getInstance(relays)` stores one instance on `globalThis`; the constructor configures it, and idempotent `start()` subscribes to permission additions/removals and starts a refresh.

`ProxyRelay` checks this gate once per logical call, not once per frame. An allowed call proceeds synchronously into the adapter; otherwise it requests the configured permissions and rejects if the user denies them. Messaging does not request Scripting permissions. The cache is not a security boundary: the browser still enforces access.

The options map comes from the bundler-generated `__ADNBN_RELAY_OPTIONS__`. An existing permission instance is not reconfigured when another map is passed. Runtime option hot replacement, revisions, and subscription disposal for HMR are not implemented; do not assume build-time cache clearing provides them.

## Discovery and transport internals

### Discovery is only for Messaging `All`

[`RelayDiscovery`](./discovery/RelayDiscovery.ts) reads the manifest synchronously and calls the `getAllFrames` wrapper from `@addon-core/browser`. Missing required `webNavigation`, an unreadable manifest, or enumeration failure rejects the call with `RelayDiscoveryError`.

It discovers frame addresses, **not registered Relay instances**. It does not use `runtime.getContexts`: [extension contexts](https://developer.chrome.com/docs/extensions/reference/api/runtime#type-ExtensionContext) are not an inventory of content-script frames in ordinary web pages.

There is no discovery ping, startup registry, fallback mode, or fixed collection window. Messaging `Any`, explicit targets, and all Scripting calls skip discovery. Do not reintroduce a guessed deadline to present an incomplete set of responders as an exhaustive frame list.

### Runtime paths

```text
getRelay(name, target) -> ProxyRelay -> permission gate -> selected adapter
    Messaging -> RelayMessage -> shared Message/RegisterTransport -> local instance
    Scripting -> Inject Script -> frame-local RelayManager.property -> local instance
```

[`ProxyRelay`](./providers/ProxyRelay.ts) owns target validation, lazy `_target`/`_adapter` initialization, and permission gating. The adapters own delivery and result normalization; the shared [`ProxyTransport`](../transport/ProxyTransport.ts) still owns RPC path construction. Relay does not introduce a separate transport protocol for Service, Offscreen, or Sandbox.

[`RelayMessagingAdapter`](./adapters/RelayMessagingAdapter.ts) uses the existing message envelope and structured remote-error marker. [`RelayScriptingAdapter`](./adapters/RelayScriptingAdapter.ts) translates Relay-owned options into `@addon-core/inject-script` options and wraps the method result in a serializable success/error envelope. This preserves a successful `undefined` return and distinguishes a remote method error from an injection failure.

The Scripting callback must remain self-contained: runtime imports or caller closures cannot be referenced from injected code. It receives its arguments and manager key explicitly. This restriction applies to the adapter's injected wrapper, not to regular bundled Relay methods. The current adapter uses the default isolated injection world and does not forward the content-script `world` option; keep Scripting Relays in that world so they share the manager.

If the frame-local manager already exists, Scripting starts the method without a preliminary timer/await. `Any` fails immediately when the manager is absent. Addressed calls and `All` retain up to 10 manager checks, 300 ms apart, to tolerate startup races. These checks wait for the manager, not a complete inventory or guaranteed readiness of every named Relay.

### Entrypoint lifecycle

The generated [`virtual Relay module`](../cli/virtual/relay.ts) combines the definition with its resolved name and attaches a content builder to [`Builder`](../entry/relay/Builder.ts). Each build:

1. Destroys the previous transport/content state.
2. Creates the instance through `init(options)` and registers it through [`TransportBuilder`](../entry/relay/TransportBuilder.ts).
3. Builds the content context.
4. Calls optional `main(instance, context, options)`.

Virtual templates are checked against the actual package source exports. The [`virtual module declarations`](../cli/virtual/virtual.d.ts) describe placeholders and derive framework constructors from the real adapters; do not add handwritten ambient declarations that shadow `adnbn` or its real subpaths.

Registration precedes `main`; do not assume an asynchronous `main` finishes before the first remote call. Keep synchronously required state in `init` or explicitly coordinate readiness in the exposed API.

[`RegisterRelay`](./providers/RegisterRelay.ts) registers Messaging listeners through the shared `RegisterTransport`. Scripting registers only the local instance in [`RelayManager`](./RelayManager.ts), exposed under `RelayGlobalKey`. Destroying the builder unregisters the transport and destroys the content context.

Messaging handlers receive the shared request-scoped `this.$sender` context. Scripting invokes the local instance directly and does not synthesize a messaging sender. Sender metadata describes the caller, not the frame selected by `Any`; do not use it to invent responder identity.

## Errors, timeouts, and data

Scalar calls resolve the method value or throw. Batch calls represent ordinary per-target failures as rejected elements and retain successful siblings. **A batch promise can still reject** for invalid targets, missing configuration, denied permissions, discovery errors, or unsupported/invalid injection requests. Catch call-level errors as well as inspecting returned outcomes.

`RelayFrameErrorKind` is a string enum. Batch errors contain `kind`, `name`, `message`, and optional `stack`:

| Kind           | Meaning                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| `Remote`       | The Relay method/property invocation failed inside its RPC envelope.           |
| `Execution`    | The injected wrapper or result processing failed outside that envelope.        |
| `Delivery`     | The transport could not deliver or observe the operation.                      |
| `Timeout`      | The configured wait expired.                                                   |
| `TargetGone`   | The target/receiver was reported missing or disappeared.                       |
| `Unobservable` | Inject Script received neither a usable native result nor an observable error. |

Messaging identifies `Remote` structurally when unwrapping an error envelope. Only the `TargetGone`/`Delivery` distinction uses browser-error text heuristics; `TargetGone` can therefore mean a missing Relay listener, not proof that the frame was destroyed. Do not classify business errors by matching their message text.

`timeoutMs` bounds each addressed Messaging response (or the single `Any` response). It does not bound Messaging discovery or permission prompts. Without it, Relay adds no Messaging timer. Scripting passes it to Inject Script; the installed package defaults to 4,000 ms and handles explicit-target/operation timeouts itself.

A timeout stops waiting, not execution. A rejected call is not proof that no frame ran the method, especially after partial Scripting execution. Do not automatically retry a mutating batch without deduplication. Relay keeps the common error fields; package-specific timeout metadata is not part of its public error contract.

Use JSON-compatible arguments and result data. Do not send DOM nodes, functions, class instances, `Blob`, `ArrayBuffer`, or cyclic structures; convert them to plain data. The Scripting envelope supports a method returning `undefined`, but that does not make arbitrary undefined-valued argument/object structures portable. Generated proxy types are a developer aid, not runtime serialization validation or an authorization boundary.

### Document targeting

`frameId` identifies a frame; `documentId` addresses a particular document. Navigation can change the document without giving the caller a stable document identity through the frame ID alone. Never silently remove a requested document selector or replace it with a broadcast.

The shared [`Message`](../message/providers/Message.ts) implementation checks Firefox's version through a cached `getBrowserInfo()` promise: the current guard accepts document targeting from version 153, and rejects older or undetectable versions with `UnsupportedMessageTargetError`. In a batch this is represented as a per-target failure. This guard belongs to Messaging, not Inject Script.

Scripting delegates native document-target capability checks to Inject Script. MV2 document targets are unsupported and reject; a capability failure must not silently fall back to frame addressing.

## User activation

Relay relies on the browser's user-activation rules; it does not create activation or guarantee that it remains available in the target frame. Extension permissions determine whether a call is allowed, while user activation determines whether an activation-gated operation can run. Granting permissions does not replace a user gesture.

Scripting deliberately preserves a short dispatch path when the cached permission state allows the call: no awaited permission refresh or discovery before injection, and no delayed manager check when the manager exists. Explicit target injections are started synchronously before their results are awaited. Keep these properties when refactoring.

Messaging uses native message delivery and inherits the browser's activation-propagation behavior. [Chromium's extension messaging implementation](https://github.com/chromium/chromium/blob/main/extensions/renderer/api/messaging/native_renderer_messaging_service.cc) can propagate a user-gesture notification to the receiving frame, but Relay does not promise this across all browsers and contexts. Messaging does not inherently mean activation is lost, and an `await` does not universally clear it: [transient activation](https://html.spec.whatwg.org/multipage/interaction.html#tracking-user-activation) can expire or be consumed.

Permission prompts, frame discovery, startup retries, and work inside the remote handler can introduce delays before an activation-gated operation. The synchronous Scripting path does not extend its guarantees to those stages. Prepare the target and permissions where practical, dispatch from the user-triggered handler, and avoid unrelated asynchronous work before the sensitive operation. Activation must be available in the context where that operation executes, not merely in the caller.

## Maintenance checklist

- Preserve the scalar/batch overloads and `true` as an alias of `Any`. Do not add a second `getRelayAll` API or make `Any` return `void`.
- Keep Relay targets independent of `InjectScriptOptions`. Translate them inside the Scripting adapter; keep ordinary content-script types boolean-only for `allFrames`.
- Keep discovery out of `Any` and Scripting. Missing strict-Messaging permission must not silently change `All` to `Any`.
- Preserve operational targets when an actual frame/document identity is unavailable, and preserve partial successes.
- Keep transport-specific behavior in adapters, Relay permission rules in `RelayDriver`, and generic aggregation in `ContentManager`.
- Keep the public export boundaries and the `adnbn/relay` registry augmentation stable. Test generated declarations against both source modules and built package exports; an `any`-typed virtual constructor must not hide incompatible options.
- Preserve the Scripting synchronous-start path, fail-fast `Any`, and fulfilled-result preference. Do not give Messaging that same success-preference promise.
- Update types, parsers, drivers, runtime tests, and this README together when changing a public contract. Shared RPC/message changes also require checking the other transport layers.

### Verification

Run from the framework repository root. Build first so targeted tests can resolve the package's public exports:

```bash
npm run build
npm run typecheck
npm run test:relay -- --runInBand
npm run test:message -- --runInBand
```

`typecheck` includes `typecheck:tests`; passing Jest alone does not prove test files are type-correct. For the full non-browser regression suite, including shared transport and content aggregation tests:

```bash
npm test -- --runInBand --testPathIgnorePatterns=tests/integration/browser
```

Important coverage lives in [`Relay.test.ts`](./providers/Relay.test.ts), [`RelayDiscovery.test.ts`](./discovery/RelayDiscovery.test.ts), [`RelayPermission.test.ts`](./RelayPermission.test.ts), [`RelayParser.test.ts`](../cli/entrypoint/parser/RelayParser.test.ts), [`RelayDriver.test.ts`](../cli/plugins/content/RelayDriver.test.ts), [`RelayDeclaration.test.ts`](../cli/plugins/content/RelayDeclaration.test.ts), and [`ContentManager.test.ts`](../cli/plugins/content/ContentManager.test.ts).

Keep regression cases for a rejected top frame plus successful iframe in Scripting `Any`, no manager retries in `Any`, partial explicit-batch failures, remote Messaging errors, document capability rejection, and permission precedence. Native frame enumeration, injection rejection semantics, and user activation require verification in a real extension context; browser mocks cannot establish those guarantees.
