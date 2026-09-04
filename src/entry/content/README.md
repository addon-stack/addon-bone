# Content entrypoints

## Shadow DOM

Set `shadow: true` to render a content entrypoint inside an open `ShadowRoot`. The framework keeps
the existing host element and its `mount` or `append` placement, creates an inner render target,
and points the React or Vanilla adapter at that container.

```tsx
import {ContentScriptAppend, ContentScriptWorld, defineContentScriptAppend} from "adnbn";

import Panel from "./Panel";

export default defineContentScriptAppend({
    matches: ["https://example.com/*"],
    world: ContentScriptWorld.Isolated,
    shadow: true,
    anchor: ".product",
    append: ContentScriptAppend.After,
    render: Panel,
});
```

Shadow content entrypoints always remain separate bundler entrypoints, even when
`concatContentScripts` is enabled. `commonChunks` remains supported, so ordinary and shadow
entrypoints may still consume the same dependency or CSS chunk. The manifest loads CSS normally for
ordinary content scripts and exposes the same file through web accessible resources when a shadow
entrypoint needs it.

Shadow DOM is supported in the effective `ISOLATED` world. `MAIN` with `shadow` fails in Manifest V3.
Manifest V2 normalizes a requested `MAIN` world to `ISOLATED` and prints a build warning before
grouping and bundling the entrypoint.

Initial styles are extension files linked inside every root. Rendering starts immediately, so a
brief unstyled frame is possible while those files load. Lazy CSS is requested with its `import()`;
the import waits for the roots active at the start of that request. A late root receives initial CSS
and every lazy stylesheet already requested by its entrypoint. Failed and timed-out lazy styles reject
the import and can be retried. The timeout follows `output.chunkLoadTimeout`.

Each entrypoint owns its style registry on its Rspack runtime. No background bundle, global `window`
registry, JSON map, or carrier file is added to another entrypoint.

## Local fonts

Browsers do not reliably register `@font-face` declared only inside a shadow stylesheet. Import a
local font and list it in `shadow.fonts` instead:

```tsx
import panelFont from "./panel.woff2";

export default defineContentScriptAppend({
    shadow: {
        fonts: [
            {
                family: "AdnbnPanelInter",
                source: panelFont,
                weight: "400",
                style: "normal",
            },
        ],
    },
    render: Panel,
});
```

Supported inputs are local `.woff`, `.woff2`, `.eot`, `.ttf`, and `.otf` imports. The emitted file
keeps the configured asset filename and hash pattern. At runtime the framework creates a `FontFace`,
adds it to `document.fonts`, and starts loading it without delaying the UI. Duplicate definitions in
one entrypoint are ignored.

Use a family name that is unlikely to collide with the page or another content entrypoint. Registered
faces remain observable in `document.fonts` until the document ends, including after the UI unmounts.
External URLs, Google Fonts, and external `@import` are unsupported: they depend on page CSP, expose a
third-party request, and do not solve shadow font registration. Self-host a local `.woff2` instead.

File stylesheets and local fonts are covered in Chrome 155 MV3 and Firefox 155 MV2/MV3, including a
page that rejects document styles and fonts through `style-src`, `style-src-elem`, and `font-src`.
Those checks also cover top documents, iframes, multiple roots, two shadow entrypoints, shared CSS,
lazy CSS, unmount, and remount.
