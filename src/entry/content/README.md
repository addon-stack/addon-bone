# Content entrypoints

## Public API

Import `defineContentScript`, `defineContentScriptAppend`, and content definition types from `adnbn`.
Import watch-strategy factories and lifecycle subscription contracts from `adnbn/content`:

```ts title="src/panel.content.ts"
import {defineContentScript} from "adnbn";
import {createMutationObserverStrategy} from "adnbn/content";

export default defineContentScript({
    anchor: "article",
    watch: createMutationObserverStrategy({
        attributes: false,
        characterData: false,
    }),
    render: () => "Hello",
});
```

`createMutationObserverStrategy(options?)` creates a debounced DOM-mutation strategy with configurable
`MutationObserverInit` options. `createAwaitFirstStrategy(options?)` provides the strategy used while
waiting for the first content nodes. Creating a strategy does not start observing; the lifecycle
starts it when processing content and invokes its returned unsubscribe function during cleanup.

`adnbn/content` also exports `ContentScriptEvent` and the `ContentScriptWatchStrategy`,
`ContentScriptContext`, `ContentScriptEventCallback`, and `ContentScriptNode` types. A custom strategy
receives `(update, context)` and returns an unsubscribe function. Use `context.watch(callback)` for
lifecycle events; its returned function removes that subscription, and `context.unwatch()` removes all
context subscriptions. `context.mount()` and `context.unmount()` run synchronously, including their
lifecycle events. Await asynchronous discovery and preparation through `builder.build()` or the
watch strategy's `update()` callback.

The public `src/content/index.ts` entrypoint explicitly exports these tools from their runtime owners.
Definition helpers live in `src/main/content.ts`; normalization and mounting helpers are internal.
Runtime code imports implementations directly, without depending on the public `adnbn/content` facade.
The separate `adnbn/entry/content` entrypoint supplies the builder, startup function, and definition
resolver required by generated modules.

## Internal organization

`lifecycle/Builder.ts` coordinates main execution, watching, context cleanup, and node events.
`lifecycle/MountBuilder.ts` is a concrete builder that composes mounting and isolation without a UI
renderer. React and Vanilla extend it with rendering. Related implementations and their tests live together:

- `lifecycle/IsolationSetup.ts`: prepares current props, invokes boundary/target handlers, and protects user cleanup.
- `lifecycle/nodes`: host mounting, node decorators, ShadowRoot/iframe targets, and the styles-runtime helper.
- `lifecycle/markers`: anchor marking and lookup strategies.
- `lifecycle/context`: the node collection, lifecycle operations, and event subscriptions.
- `resolvers`: shared option handlers and definition merging, without framework detection or rendering.
- `adapters/react` and `adapters/vanilla`: default-export interpretation, render normalization, and UI rendering.
- `index.ts`: the common runtime entrypoint, exporting `MountBuilder` as `Builder` and its startup resolver.

Pure structural validation and the frame-navigation predicate live in `src/shared/content/isolation.ts`.
CLI and runtime import this shared module independently; the parser does not import runtime resolvers.

A blank iframe uses its React/Vanilla adapter with the shared `FrameNode`. The runtime
`adnbn/entry/content` import resolves to the common builder without importing renderer adapters. Internally,
`virtual:content-builder` selects either that builder or a renderer adapter. The selected entrypoint
exports both its builder and `resolveDefinition`; the generated content module imports
them together. `.tsx`/`.jsx` selects React, while the other currently supported script extensions select
Vanilla. `isolation.page`/`isolation.src` selects the common builder regardless of the filename, for both
Content and Relay. Scripts with only `main` use the filename-based selection.

Each adapter interprets its own default export before shared code merges options. Default options
override named options; a recognized default render value overrides a named `render`. React uses
`isValidElement` to recognize elements without exposing that dependency to Vanilla or the common runtime.
For React UI, pass a React element or component function. Component functions are invoked by React
and may use hooks. Vanilla renders DOM elements, nonempty strings, and numbers.
`mergeDefinition` combines exports using the selected resolver's interpretation of default
values. The common `resolveDefinition` accepts configuration without recognizing framework
components; adapters provide their own definition resolvers. The common builder accepts absent rendering and literal `render: true`; UI rendering requires an adapter. Vanilla keeps its value check and
synchronous handler normalization together in `adapters/vanilla/resolvers/render.ts`, used internally by the
Vanilla builder.

The CLI `ContentParser.ts` and its test live beside the other parsers in `src/cli/entrypoint/parser`.
Content fixtures live in `parser/tests/fixtures/content`. The helper in
`parser/utils/content/default-render.ts` interprets source metadata from `entrypoint/file` without loading UI runtimes. In particular, it
rejects known default render exports with frame navigation, including explicit element objects.
The common runtime also rejects an explicit `render` property with frame navigation.
Relay interprets its default export as transport initialization.

The common lifecycle wraps each complete node in `EventNode`, including any adapter renderer, before
adding it to the context. Mount/unmount events follow the underlying node operations. Without render,
`main` runs and context cleanup is available. Anchor processing starts for rendering, `prepare`,
headless tracking, or page/src navigation. `FrameNode` owns iframe creation, navigation, and
child-document recovery.

When adding a runtime adapter, implement its definition and render resolvers and expose the definition
resolver from that adapter's `index.ts`. Extend filename/build support and parser metadata interpretation
as required by the framework. Runtime adapters are selected individually; do not aggregate their
implementations through a common barrel. The content define helpers stay at the root `adnbn` import.

Content contracts live in `src/types/content`:

- `common.ts` owns shared options, isolation, props, containers, markers, nodes, and lifecycle contracts.
- `prepare.ts` owns per-anchor preparation inputs, results, and handlers.
- `boundary.ts` maps isolation modes to their DOM boundaries and owns setup props, handlers, and cleanup.
- `target.ts` owns target descriptions and synchronous target factory contracts.
- `definition.ts` composes entrypoint definitions and preserves the frame-navigation restrictions.
- `adapters/vanilla.ts` and `adapters/react.ts` describe each adapter's render values.
- `adapters/index.ts` exports the types of all adapters for the shared render contract and public exports.
- `render.ts` combines those values into the shared render contract and handler.
- `index.ts` exports the contracts through `@typing/content` and the public `adnbn` entrypoint.

Keep adapter-internal imports pointed at the owning file. To add an adapter's types, define its
render values under `adapters`, export them from `adapters/index.ts`, and include them in `render.ts`.
`defineContentScript` and `defineContentScriptAppend` accept the combined contract from
`adnbn`; runtime adapter selection is based on the entrypoint filename. Adding types does not
implement the adapter or its build support.

## Preparation and render props

`prepare` runs once for each discovered anchor, before creating its UI. It receives the anchor and
entrypoint options and may return a Promise. Returning `false` keeps a tracked node in the context
without invoking the container factory or renderer. Other results become `props.data`; without
`prepare`, `data` is `undefined`. DOM mutations and ordinary remounts do not repeat preparation for
a tracked anchor.

For newly discovered anchors, failures in preparation, container creation, or synchronous
mounting/rendering are collected and logged as an `AggregateError` after each processing pass. Successful anchors
remain available, and a failure on the first pass does not prevent the watcher from starting. The same
policy applies to later passes. Use `watch: true` to keep processing new anchors; the default strategy
stops watching once it has tracked nodes. A failed anchor is not added as a headless result.
Initialization errors, such as a rejected marker factory or `main`, reject the build. React
component errors during React's scheduled rendering follow React's error handling.

```tsx title="src/product.content.tsx"
import React from "react";
import {defineContentScript} from "adnbn";
import {getProduct} from "./product-service";
import {ProductCard} from "./ProductCard";

export default defineContentScript({
    anchor: ".product",
    isolation: {type: "shadow", mode: "closed"},

    prepare: async ({anchor}) => {
        const product = await getProduct(anchor.getAttribute("data-id"));

        return product.available ? {product} : false;
    },

    render: ({data, container, target}) => (
        <ProductCard product={data.product} host={container} portalTarget={target} />
    ),
});
```

`ContentScriptProps<Data>` contains `anchor`, `data`, `container`, `boundary`, `target`, and entrypoint options.
`container` is the outer mounted element; `target` is the actual UI destination. They are equal
without isolation. Shadow rendering uses an inner element inside its root; iframe rendering uses
an element inside the child document. `boundary` is the `ShadowRoot` (including closed roots), the
`HTMLIFrameElement`, or `undefined` without isolation. Use `target` for portals and
`target.ownerDocument` for its document. The outer `container` remains available for placement and styling.

Container factories receive `ContentScriptContainerProps<Data>`: anchor, options, and prepared data,
without a container, boundary, or target. React components are invoked by React with the completed render props.
Render handlers are synchronous; asynchronous requests and decisions belong in `prepare`. An empty Vanilla
result releases that UI and leaves the anchor tracked; use `prepare` for decisions that must precede DOM creation.

Literal `render: true` tracks anchors without creating containers, Shadow roots, iframes, or renderer
instances. It works with both adapters and Relay. Use it for parsing existing nodes through the context.

Destroying the builder or removing the anchor invalidates pending results. A new target on remount
or iframe document recovery receives fresh props and reruns rendering with the same prepared data.
Mounting an unchanged target preserves its UI and React state. `RenderNode` mounts DOM and invokes the
renderer synchronously; adapter nodes own UI insertion and disposal. `EventNode` emits Mount before
`mount()` returns, after the adapter accepts the render value. React schedules its component rendering
and effects independently; Mount does not wait for a React commit. A render callback that unmounts or
replaces its own target cannot subsequently insert UI into the discarded target or emit a stale Mount.

## Isolation

### Boundary setup and cleanup

`boundary` is a synchronous setup handler for an existing isolation node. It is available with
Shadow DOM and all iframe variants, including `isolation.page` and `isolation.src`, and is forbidden
without isolation. The handler receives `ContentScriptBoundaryProps<Data, Isolation>`: `anchor`,
prepared `data`, the outer `container`, the typed `boundary`, and entrypoint options. It does not
receive an inner `document` or `target`, which are not ready at this stage. `prepare` may compute
layout values asynchronously; the boundary handler applies them after isolation exists.

The lifecycle calls it once for each newly created boundary: after `attachShadow()` for Shadow DOM,
or after creating the iframe but before assigning `src` and inserting it.
Iframe geometry and its child document are not ready during setup. Use `target`/render or lifecycle
events for work that needs the mounted UI. Page and URL navigation remains owned by `isolation`.

Return nothing, or a synchronous cleanup function to unsubscribe listeners and observers:

```ts title="src/panel.content.ts"
import {defineContentScript} from "adnbn";

export default defineContentScript({
    isolation: "shadow",

    boundary: ({boundary}) => {
        const onProbe = () => console.info("Boundary event");
        boundary.addEventListener("panel-probe", onProbe);

        return () => boundary.removeEventListener("panel-probe", onProbe);
    },

    render: () => "Panel",
});
```

Cleanup runs once before removal, including rollback after a synchronous target/render error. A cleanup error
is logged without preventing the remaining nodes from being released. Mount requests made while
unmounting the context do not recreate UI. The handler reruns for a new boundary on full remount;
intact mounts and replacement of the document/target inside the same iframe keep the existing setup
and subscriptions. `prepare: () => false` and headless `render: true` never create a boundary or invoke
its handler. Setup errors follow the same per-anchor error handling as target creation.

`mount` controls container placement; `boundary` configures isolation; `target` creates the inner
render destination. These handlers are runtime behavior, not serialized entrypoint configuration.
Content, append content, and Relay share the same contract and inferred boundary types.

Internally, `MountBuilder` creates one `IsolationSetup` instance per isolated anchor and passes it to
`ShadowNode` or `FrameNode`. It reads current props and the container through callbacks, so remounts
use the replacement container. Its `setup()` and `createTarget()` operations stay independent:
iframe document recovery creates a new target without repeating boundary setup. The isolation nodes
retain cleanup ownership, DOM insertion, style registration, and checks for synchronous unmounts.

### Target configuration and boundary access

The `target` option controls the inner render element without changing the outer container. It accepts
a tag name, an object with `tagName` and DOM properties, or a synchronous factory. The default is `div`.
Use it with Shadow DOM or an iframe rendering local UI. It is unavailable without isolation or with
`isolation.page`/`isolation.src`, where there is no local render target.

```tsx title="src/panel.content.tsx"
import React from "react";
import {defineContentScript} from "adnbn";

export default defineContentScript({
    anchor: "article",
    isolation: {type: "iframe"},
    prepare: ({anchor}) => ({title: anchor.getAttribute("aria-label") ?? "Panel"}),

    boundary: ({boundary, container, data}) => {
        boundary.title = data.title;
        boundary.style.height = "240px";
        container.setAttribute("data-panel", "ready");
    },

    target: ({document}) => {
        const element = document.createElement("section");
        element.className = "panel-root";

        return element;
    },

    render: ({data, boundary}) => (
        <span>
            {data.title} · {boundary.title}
        </span>
    ),
});
```

For a simple Shadow target, use `isolation: "shadow", target: "span"` or
`target: {tagName: "section", className: "panel-root"}`. Object options are DOM properties;
set styles through a factory's element or `boundary`. In Shadow mode, style the host through
`container` or `boundary.host`; the root itself is not a styled element.

The factory receives `ContentScriptTargetProps<Data, Isolation>`: `anchor`, prepared `data`,
entrypoint options, the mounted `container`, `boundary`, and `document`. The document is supplied
in both modes: the container's document for Shadow, and the child document for iframe. Return a new,
detached element from this document, a tag name, or a properties object. The lifecycle inserts it and
manages its removal. Async work belongs in `prepare`; a Promise or an invalid factory result is rejected.

The factory runs after the isolation boundary exists and before rendering. It runs again for a new
target after remount or iframe document recovery, retaining the prepared data. Mounting an intact target
does not rerun it. `render: true` and `prepare: () => false` do not invoke it or create isolation DOM.
Factory failures release the partially mounted UI and follow the per-anchor error policy above.

Inline factories and render functions infer the boundary type from string, enum, or object isolation.
For a reusable Shadow component, annotate its props as `ContentScriptProps<Data, "shadow">`;
use `"iframe"` for an iframe component. Omitting the second parameter allows all boundary types and
requires narrowing before using mode-specific properties. The same parameters apply to
`ContentScriptDefinition` and `ContentScriptTargetFactory`.
When supplying generic arguments to a define helper explicitly, provide both data and mode, for example
`defineContentScript<Product, "iframe">({...})`; otherwise let the helper infer them from `prepare` and `isolation`.

Context nodes and lifecycle callbacks also expose `node.boundary`, including navigation iframes.
It is available at Mount and cleared at Unmount, so read it from the current node after remount instead
of retaining an old reference. These shared context APIs can contain different modes and expose the union
`ShadowRoot | HTMLIFrameElement | undefined`; narrow it before using mode-specific APIs. A navigation
iframe's boundary does not grant access to a cross-origin child document.

### Isolation options

`isolation` accepts `ContentScriptIsolation.None`, `Shadow`, or `Iframe`, or their string values
`"none"`, `"shadow"`, and `"iframe"`. For additional options, use an object with a required `type`
containing the same enum or string value. The default is `None`. Isolation changes the render target;
existing anchors, containers, mount/append placement, and context methods remain available.

```tsx title="src/panel.content/index.tsx"
import {ContentScriptIsolation, defineContentScriptAppend} from "adnbn";
import "./panel.scss";
import Panel from "./Panel";

export default defineContentScriptAppend({
    matches: ["https://example.com/*"],
    anchor: ".product",
    isolation: {type: ContentScriptIsolation.Iframe},

    boundary: ({boundary}) => {
        boundary.style.height = "320px";
    },

    render: Panel,
});
```

| Type                    | Target                                               | Additional isolation options    |
| ----------------------- | ---------------------------------------------------- | ------------------------------- |
| None                    | Host container                                       | None                            |
| Shadow                  | Inner element in a ShadowRoot                        | Optional `mode`, default `open` |
| Iframe without page/src | Inner element in a blank iframe document             | None                            |
| Iframe with page/src    | Embedded document owns its UI; `render` is forbidden | `page` or `src`                 |

The framework does not assign iframe dimensions or inline styles. Configure dimensions, borders,
display, and other DOM properties through the `boundary` handler before insertion/navigation.
Browser defaults and page styles apply unless you override them. CSS sizes use their normal string
values; automatic content-based iframe sizing is not provided. The blank iframe has no `src`
attribute. The framework creates the host and target, so a custom `container` factory is optional.

Import UI styles normally and declare fonts in SCSS as described below. Relay supports the
same isolation and frame variants; its RPC transport and all-frame addressing remain independent
of UI isolation.

## Shadow options

Set `mode` inside an isolation object with `type: Shadow`, in content scripts or Relay:

```tsx title="src/panel.content/index.tsx"
import {ContentScriptIsolation, ContentScriptShadowMode, defineContentScriptAppend} from "adnbn";
import "./panel.scss";
import Panel from "./Panel";

export default defineContentScriptAppend({
    isolation: {type: ContentScriptIsolation.Shadow, mode: ContentScriptShadowMode.Closed},
    render: Panel,
});
```

`mode` accepts `ContentScriptShadowMode.Open` / `Closed` and the string literals `"open"` / `"closed"`.
The shorthand `isolation: "shadow"` and `{type: "shadow"}` both keep the default `open` behavior.
`mode` is only valid for Shadow; `page` and `src` are only valid for Iframe.

In closed mode, `host.shadowRoot` returns `null`. The framework retains its own reference, so
`node.target`, initial and lazy CSS, renderer cleanup, and remount still work. The mode is selected
when creating the root; changing an already mounted root's mode is not supported.

Closed mode does not hide the UI, change CSS isolation, or provide a security boundary. Composed
events can still reach the page; their external `composedPath()` omits closed-root internals.
Code that needs the rendered element should use the framework's `target`, not query `host.shadowRoot`.

## Embedding a document

```ts title="src/panel-frame.content.ts"
import {defineContentScriptAppend} from "adnbn";

export default defineContentScriptAppend({
    matches: ["https://example.com/*"],
    isolation: {type: "iframe", page: "panel"},

    boundary: ({boundary}) => {
        boundary.style.height = "320px";
    },
});
```

`prepare` can also control document embedding. Returning `false` for an anchor skips the container
factory and iframe creation for both `isolation.page` and `isolation.src`. The anchor stays tracked
without UI; remounting it does not rerun preparation or create the iframe.

`page` is a generated, typed page alias. Its HTML must already be accessible through the final
manifest's web accessible resources. In MV3 those rules must cover every content-script match origin;
paths, exclusions and globs do not reduce this check. In MV2 the resource must be in the flat WAR list.
Rules can come from `page.matches` or custom manifest configuration and jointly provide coverage.
Insufficient coverage fails the build with a hint to add page matches or narrow content matches; the
framework does not broaden access automatically.

Use `isolation: {type: "iframe", src: "https://example.com/panel"}` for an absolute HTTP(S) URL. Absolute extension URLs
are also accepted. Relative paths and other schemes are unsupported. `page` and `src` are mutually
exclusive and cannot be combined with `render`. The child page loads its own scripts,
styles and fonts. A frame `load` event or the context's `Mount` event does not prove that embedding
succeeded: host CSP, destination CSP/frame-ancestors or X-Frame-Options can block it.

For content scripts, a default-exported component or render function also conflicts with
`isolation.page`/`isolation.src` and is checked during the build. A default-exported options object remains
configuration. A Relay's default function is `init`, not an implicit renderer.

Isolation options must be statically known. Objects and arrays can reference local or imported
constants and supported enum members. Static object/array spreads and computed string or numeric
keys are supported. Unresolved identifiers, function calls, methods and circular references in build
options produce an error naming the field and source file; the CLI never executes entrypoint code
to compute these values. Only build properties are evaluated, so runtime functions such as `render`
and `main` remain untouched. CLI and runtime both normalize shorthand values to an object
with `type`; Shadow DOM also receives the default `mode: "open"` when omitted. Runtime handlers,
including `prepare`, `boundary`, and `target`, are not evaluated by the CLI.

## Execution worlds and lifecycle

Shadow, blank iframe, extension URLs and `isolation.page` require effective `ISOLATED`. HTTP(S)
`isolation.src` also supports `MAIN`. MV2 normalizes requested `MAIN` to `ISOLATED` with a build warning
before grouping and bundling. Unsupported MV3 combinations fail the build.

In a blank iframe, React/Vanilla JavaScript executes in the content-script runtime and renders
into the child document. This is visual/document isolation, not a separate JavaScript security
boundary. Code using `document`, portals or document-level listeners must deliberately use
`node.target.ownerDocument` when it intends to address the child document.

A blank iframe needs a connected host before its render target can be initialized. A custom `mount`
must attach the container to the document before returning. If it does not, mounting reports the
disconnected container explicitly; the framework does not attach it automatically or wait for it.

Moving or detaching/reinserting a host can reset the iframe document. On iframe `load`, the framework
checks both the document and render target and coalesces recovery through `context.mount()`. CSS,
fonts and the renderer are restored, including when the initial anchor search has already stopped.
Recovery does not add a duplicate node or emit Add/Remove; it emits one Mount. Initial load of an
intact document does not remount. There is no background polling. Unmount cancels pending recovery
and releases style waits before removing the host.

When restoring an iframe document, each reconnected stylesheet may retry once on a load error.
This handles Firefox cancelling a shared in-flight CSS request when the previous document is
discarded. The retry replaces the failed link in the same cascade position and shares its original
`output.chunkLoadTimeout` budget. A timeout or second failure is reported; unmount cancels both attempts.
Only styles reconnected during recovery (initial and previously requested lazy CSS) receive this
retry. Initial mounting, Shadow DOM, and future lazy imports retain their usual failure behavior.
The browser's link error event does not identify cancellation, so any load error during recovery
can receive this one retry. The framework does not change URLs or use inline CSS to recover.

React local state is lost after a real document reset. Keep persistent state outside the component
if it must survive. For page/src, reload remains ordinary browser navigation behavior.

## Styles and fonts

Shadow and all iframe entries bypass `concatContentScripts`. They support `commonChunks`.
For Shadow and blank iframe content/Relay entries, ordinary CSS/SCSS imports go to the isolated
render target. This includes styles imported by child components, shared components, libraries and
lazy modules. Mark only host-page styles with `?unisolated`:

```ts title="src/panel.content/index.ts"
import "./host.scss?unisolated";
import styles from "./panel.module.scss";

export {};
```

The query controls delivery, not CSS Modules. Module exports and class names retain their normal
behavior. CSS imports and Sass dependencies inherit their stylesheet's destination. To deliver a
stylesheet outside the UI, put the query on its JavaScript/TypeScript import; Sass `@use`/`@forward`
compile into their parent stylesheet and do not create another delivery destination.

Initial isolated CSS is excluded from `content_scripts.css` and exposed through WAR. Each root or
iframe head receives its own links in dependency order. Initial `?unisolated` CSS goes into the
content manifest. Lazy styles of both destinations still wait for `import()`.

A component shared between popup and content needs no special imports: the popup gets ordinary
page CSS, while a Shadow/blank-iframe consumer gets isolated CSS. Shared sources can be emitted
separately by destination. If identical CSS resolves to one contenthash filename, that file can
appear both in the content manifest and in isolated delivery. `getEntrypointAssets()` still includes
the complete inventory in `initial.css` / `async.css`, without delivery-specific fields.

With `isolation: None`, styles load into the host document. Outside content and Relay, including
popup and page entries, `?unisolated` adds no behavior or isolated-style runtime.
`isolation.page`/`isolation.src` entries do not render locally: their imports style the host document;
import the embedded UI's styles in the embedded page itself.

The `adnbnDocumentStyles` cache group extracts `?unisolated` CSS only from chunks reachable by
Shadow/blank-iframe entries, including lazy chunks. Default UI CSS stays in its original chunk.
Ordinary pages, popup/options, content and Relay entries keep both categories together unless they
share a physical chunk with an isolated consumer. No extra category priority is imposed on those
unsplit files; Rspack's normal CSS ordering applies. This does not enable general common-CSS extraction.

A lazy chunk shared by ordinary and isolated entries must be split for both consumers. In the
ordinary document, the two files follow chunk order, which can differ from source import order.
On the tested Rspack version, document CSS precedes UI CSS for both source orders. This is a shared
physical-chunk constraint, not a query-priority contract. In Shadow/iframe the destinations differ.

Preserve `adnbnDocumentStyles` when customizing `splitChunks`: a mixed-destination chunk reachable
by an isolated entry fails the build instead of injecting CSS into the wrong document. Mixed CSS
is legal for ordinary-only entries. The required partition also applies with `commonChunks: false`.
Initial chunks (including extracted chunks) use `cssFilename`; async chunks use `cssChunkFilename`
when configuring the CSS extraction plugin directly.

Rendering starts immediately, so briefly unstyled UI is possible. Lazy CSS is requested with
`import()`; mixed imports wait for both document CSS and targets active at that request's start. Late targets receive initial
and already requested lazy CSS. Imports before the first target do not wait for future UI. Failed
or timed-out lazy links reject the import and permit retry; timeout follows `output.chunkLoadTimeout`.
Initial CSS errors identify the entrypoint and URL but do not remove UI. Styles are delivered through
external stylesheet links. Registries belong to each entry runtime, not `window`; no carrier,
JSON map or background bundle is injected into other entries.

For Shadow, declare `@font-face` in `fonts.scss?unisolated`, then use that family in ordinary UI
SCSS. `@font-face` inside a shadow stylesheet does not reliably register the face. Use a unique family
name: the document declaration is visible to the host page and outlives UI unmount.

```scss title="src/panel.content/fonts.scss"
@font-face {
    font-family: "AdnbnPanelInter";
    src: url("./panel.woff2?browser") format("woff2");
    font-weight: 400;
}
```

Both `?browser` and `?chrome` explicitly emit an extension URL for the build target, including
`moz-extension://__MSG_@@extension_id__/` for Firefox and `chrome-extension://__MSG_@@extension_id__/`
for Chromium targets. Without either query, assets retain normal bundler URL handling.
These queries support fonts, images, media,
documents and explicitly imported binary files; `?base64` keeps inline asset delivery. Code, JSON,
stylesheets and specialized `?react`/`?raw` imports retain their own loaders. The localization token
is interpreted in CSS, not JavaScript: use the browser `getUrl()` helper for ordinary JS asset
imports rather than treating that token as a ready runtime URL. User asset names and hashes remain intact.

For a blank iframe, put `@font-face` directly in its ordinary SCSS and use a local relative font URL.
It belongs to that iframe document; a host-page font declaration does not register it there. If both
destinations need the face, import a small shared font stylesheet from both destination stylesheets.
After document recovery, reconnecting the iframe CSS restores its font declarations too.

There is no `FontFace` registration, global font registry, or eager font loading in framework runtime.
The browser loads fonts when used. Self-host local WOFF2 files; external font `@import` and Google Fonts
depend on network, privacy choices and page CSP and are not a supported replacement in this contract.

## Verification

Chrome MV3 and Firefox MV2/MV3 integration fixtures exercise strict CSP, initial and lazy CSS,
React and Vanilla, multiple entries/targets, real font use measured by text width, iframe movement,
cleanup/remount, extension pages, and allowed/blocked external embedding. Reports record exact browser
versions under `.cache/integration`. The build watch test covers isolation transitions, fonts, page
alias changes and removal of outdated WAR rules. The `addon` playground exercises content and Relay
on YouTube and Instagram, including Shadow DOM, iframe rendering, headless tracking, and remount controls.
