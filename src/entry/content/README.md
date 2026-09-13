# Content entrypoints

## Internal organization

`core/Builder.ts` and `core/MountBuilder.ts` coordinate the content lifecycle. Related implementations
and their tests live together:

- `core/nodes`: host mounting, node decorators, ShadowRoot/iframe targets, and the styles-runtime helper.
- `core/markers`: anchor marking and lookup strategies.
- `core/context`: the node collection, lifecycle operations, and event subscriptions.
- `core/resolvers`: normalization of content definitions and option handlers.
- `adapters/react` and `adapters/vanilla`: UI rendering implementations.
- `frame`: document navigation for `isolation.page` and `isolation.src`, without a UI renderer.

Pure structural validation and the frame-navigation predicate live in `src/shared/content/isolation.ts`.
CLI and runtime import this shared module independently; the parser does not import runtime resolvers.

A blank iframe still uses its React/Vanilla adapter with the shared `FrameNode`. The public
`adnbn/entry/content/frame` import resolves to the separate frame builder. Internally,
`virtual:content-builder` selects either that builder or a renderer adapter.

## Isolation

`isolation` accepts `ContentScriptIsolation.None`, `Shadow`, or `Iframe`, or their string values
`"none"`, `"shadow"`, and `"iframe"`. For additional options, use an object with a required `type`
containing the same enum or string value. The default is `None`. Isolation changes the render target;
existing anchors, containers, mount/append placement, and context methods remain available.

```tsx title="src/panel.content/index.tsx"
import {ContentScriptIsolation, defineContentScriptAppend} from "adnbn";
import "./panel.css?isolation";
import Panel from "./Panel";

export default defineContentScriptAppend({
    matches: ["https://example.com/*"],
    anchor: ".product",
    isolation: {type: ContentScriptIsolation.Iframe, height: 320},
    render: Panel,
});
```

| Type                    | Target                                               | Additional isolation options         |
| ----------------------- | ---------------------------------------------------- | ------------------------------------ |
| None                    | Host container                                       | None                                 |
| Shadow                  | Inner element in a ShadowRoot                        | Optional `mode`, default `open`      |
| Iframe without page/src | Inner element in a blank iframe document             | Optional `width` and `height`        |
| Iframe with page/src    | Embedded document owns its UI; `render` is forbidden | `page` or `src`, optional dimensions |

`isolation.width` and `isolation.height` accept pixels as numbers or CSS strings. Defaults are `100%` and
`150px`, with no border and `display: block`. Automatic height is not implemented; `height: "auto"`
produces an error. The blank iframe has no `src` attribute. The framework creates the host and target,
so a custom `container` factory is optional.

Import UI styles with `?isolation` and declare fonts in CSS as described below. Relay supports the
same isolation and frame variants; its RPC transport and all-frame addressing remain independent
of UI isolation.

## Shadow options

Set `mode` inside an isolation object with `type: Shadow`, in content scripts or Relay:

```tsx title="src/panel.content/index.tsx"
import {ContentScriptIsolation, ContentScriptShadowMode, defineContentScriptAppend} from "adnbn";
import "./panel.css?isolation";
import Panel from "./Panel";

export default defineContentScriptAppend({
    isolation: {type: ContentScriptIsolation.Shadow, mode: ContentScriptShadowMode.Closed},
    render: Panel,
});
```

`mode` accepts `ContentScriptShadowMode.Open` / `Closed` and the string literals `"open"` / `"closed"`.
The shorthand `isolation: "shadow"` and `{type: "shadow"}` both keep the default `open` behavior.
`mode` is only valid for Shadow; iframe dimensions and page/src are only valid for Iframe.

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
    isolation: {type: "iframe", page: "panel", height: 320},
});
```

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
with `type` and the mode/dimension defaults; runtime rendering values are not evaluated by the CLI.

## Execution worlds and lifecycle

Shadow, blank iframe, extension URLs and `isolation.page` require effective `ISOLATED`. HTTP(S)
`isolation.src` also supports `MAIN`. MV2 normalizes requested `MAIN` to `ISOLATED` with a build warning
before grouping and bundling. Unsupported MV3 combinations fail the build.

In a blank iframe, React/Vanilla JavaScript still executes in the content-script runtime and renders
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

Shadow and all iframe entries bypass `concatContentScripts`. `commonChunks` is still supported.
Plain CSS/SCSS imports keep document delivery: initial CSS goes into `content_scripts.css`; lazy CSS
loads into the page only when its `import()` runs. UI isolation does not change plain imports.

```ts title="src/panel.content/index.ts"
import "./host.css?asis";
import styles from "./panel.module.css?isolation";
```

`?isolation` sends CSS to ShadowRoot or the blank iframe document. Combine it with `?asis` as
`?isolation&asis` to disable CSS Modules; the two flags have independent roles. Local CSS imports and
Sass dependencies inherit their stylesheet's destination. A separate CSS import in JavaScript chooses
its own destination.

Initial isolated CSS is excluded from `content_scripts.css` and exposed through WAR. Each root or
iframe head receives its own links in asset-map order. A shared CSS file can remain in an ordinary
consumer's manifest and also be linked by an isolated consumer. `getEntrypointAssets()` retains every
CSS file in `initial.css` / `async.css`. The isolated styles runtime owns CSS routing; the asset map does not expose delivery-specific subsets.

With `isolation: None`, marked CSS loads normally into the page. Outside content and Relay, including
popup and page entries, `?isolation` has no routing effect and adds no isolated-style runtime.
`isolation.page`/`isolation.src` entries have no local render target: importing `?isolation` CSS there is a build
error. Import the styles in the embedded page instead. That page's own CSS behaves normally.

The build reports `[adnbn:missing-isolation-css]` when a Shadow or blank-iframe content/Relay entry
has CSS dependencies but none are marked `?isolation`. The check includes initial, shared and lazy CSS;
it reports once per entry per compilation and is refreshed in watch mode. It does not change asset
delivery. Entries without CSS, non-isolated entries, embedded pages and unrelated entrypoints are
not warned. Document-only CSS is legitimate, for example when only a font is imported and the UI uses
inline styles. To silence this diagnostic intentionally, use the existing bundler warning filter:

```ts title="adnbn.config.ts"
import {defineConfig} from "adnbn";

export default defineConfig({
    bundler: {
        ignoreWarnings: [/\[adnbn:missing-isolation-css\]/],
    },
});
```

This is a heuristic: a single correctly marked dependency prevents the warning even if another UI
stylesheet is missing its query. Initial document CSS still goes into the manifest; lazy document
CSS still waits for its import.

Rspack separates CSS destinations before emitting assets. Preserve the `adnbnIsolatedStyles` cache
group if customizing `splitChunks`: a chunk mixing destinations fails the build rather than injecting
styles into the wrong document. This partition is necessary even with `commonChunks: false`.

Rendering starts immediately, so briefly unstyled UI is possible. Lazy CSS is requested with
`import()`; mixed imports wait for both document CSS and targets active at that request's start. Late targets receive initial
and already requested lazy CSS. Imports before the first target do not wait for future UI. Failed
or timed-out lazy links reject the import and permit retry; timeout follows `output.chunkLoadTimeout`.
Initial CSS errors identify the entrypoint and URL but do not remove UI. There is no inline-CSS or
constructed-stylesheet fallback. Registries belong to each entry runtime, not `window`; no carrier,
JSON map or background bundle is injected into other entries.

For Shadow, declare `@font-face` in ordinary document CSS, then use that family inside `?isolation`
CSS. `@font-face` inside a shadow stylesheet does not reliably register the face. Use a unique family
name: the document declaration is visible to the host page and outlives UI unmount.

```css title="src/panel.content/host.css"
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

For a blank iframe, put `@font-face` directly in its `?isolation` CSS and use a local relative font URL.
It belongs to that iframe document; a host-page font declaration does not register it there. If both
destinations need the face, import a small shared font stylesheet from both destination stylesheets.
After document recovery, reconnecting the iframe CSS restores its font declarations too.

There is no `FontFace` registration, global font registry, or eager font loading in framework runtime.
The browser loads fonts when used. Self-host local WOFF2 files; external font `@import` and Google Fonts
depend on network, privacy choices and page CSP and are not a supported replacement in this contract.

## Verification

Chrome 155 MV3 and Firefox 155 MV2/MV3 integration fixtures exercise strict CSP, initial and lazy CSS,
React and Vanilla, multiple entries/targets, real font use measured by text width, iframe movement,
cleanup/remount, extension pages, and allowed/blocked external embedding. Reports record exact browser
versions under `.cache/integration`. The build watch test covers isolation transitions, fonts, page
alias changes and removal of outdated WAR rules. The local `addon` playground has native Shadow and
iframe panels with separate resource statuses.
