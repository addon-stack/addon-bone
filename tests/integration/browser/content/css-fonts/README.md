# CSS font delivery probe

Browser check for local CSS font declarations used inside ShadowRoot and iframe documents.
This fixture verifies browser resource loading independently of mixed CSS routing in the
production Rspack pipeline.

## Mechanism

- `page.css` is included in `content_scripts.css`. It declares one local font directly and
  imports another declaration through `imported-font.css` (bundled into the same output CSS).
- `isolated.css` is loaded as a file through a link in each ShadowRoot or blank iframe head.
- The script creates no FontFace objects and never calls `document.fonts.add()` or
  `document.fonts.load()`. Rendering text triggers the browser's normal CSS font loading.
- Two shadow roots use the families declared in manifest CSS. Two iframe documents use their
  own CSS family. The second root/document is created after the first completes.
- Each isolated document also attempts to use the parent's families. Their fallback widths
  demonstrate that parent font registration does not cross the iframe boundary.
- The synthetic font is reused from `isolation-shadow`. `AAAA` at 40px measures exactly 320px;
  the monospace fallback measures about 96.33px. A font-family string alone is not evidence.

The fixture uses esbuild only to bundle the probe, resolve the local CSS import and emit the
font with a hashed filename. Its manifest is explicit so this browser check is independent
of the framework routing implementation. No generated bundle is patched afterward.

## Results

Verified locally on Chrome 155.0.8043.4 MV3 and Firefox 155.0.1 MV2/MV3.
All three targets pass both without page CSP and with:

```text
default-src 'none'; style-src 'none'; style-src-elem 'none'; font-src 'none'; frame-src 'self'
```

| Declaration and consumer                                  | Chrome MV3 | Firefox MV2/MV3 |
| --------------------------------------------------------- | ---------- | --------------- |
| Manifest CSS font, used inside ShadowRoot                 | 320px      | 320px           |
| Locally imported font declaration, used inside ShadowRoot | 320px      | 320px           |
| Iframe CSS font, used inside the iframe                   | 320px      | 320px           |
| Parent font, referenced inside an iframe                  | Fallback   | Fallback        |

The shadow-only `@font-face` measurement also remains at the fallback width in these browser
versions; the working shadow fonts come from the document's manifest CSS.

### Chrome URL requirement

The initial run with relative font URLs in manifest CSS failed in Chrome: the faces had status
`error` and text remained at the fallback width. Firefox resolved the same paths successfully.
Relative URLs in CSS linked inside the iframe worked in both browsers.

For Chrome's manifest CSS, the test build now emits
`chrome-extension://__MSG_@@extension_id__/assets/<hashed-font>.woff2` via esbuild's `publicPath`.
Chrome substitutes the ID natively when loading extension CSS. This is its documented resource
URL mechanism, not a DOM marker, font runtime, post-build string rewrite, or fixed extension ID.
Firefox keeps CSS-relative URLs. Both use explicit web-accessible resources.

Sources: [Chrome content-script resources](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#access-other-files),
[Firefox injected CSS URL resolution](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts#css).

## Reproduce

From the repository root, with dependencies and supported browser binaries installed:

```sh
npx jest --runTestsByPath tests/integration/browser/content/css-fonts.integration.test.ts tests/integration/browser/content/css-fonts.firefox.integration.test.ts --runInBand
```

Override detection with `ADNBN_CHROME_BIN` and `ADNBN_FIREFOX_BIN` if needed. The test uses the
existing CDP/BiDi harness, temporary profiles and a local HTTP server. It writes measurements
under `.cache/integration/css-fonts-<browser>-mv<version>.json` and removes temporary extensions
and browser profiles. Google Fonts and external services are not used.

## Architectural conclusion and scope

CSS supplies the fonts in the tested matrix, provided each declaration reaches the right document
and its resource URLs are correct.

Production routing, manifest/WAR, asset maps and watch are tested separately
by `build/style-routing`, `build/isolation`, and the `isolation-shadow`, `isolation-iframe`, and `relay-styles`
browser fixtures. This probe alone does not establish those guarantees, support for native remote
CSS imports, or compatibility with every browser version. It also does not test iframe recovery
after a document reset or lazy loading of document-level font CSS.
