# Shadow DOM content integration

This fixture exercises the production `shadow` content-entrypoint API with the native Vanilla
renderer. It contains two shadow entrypoints and one ordinary entrypoint. All three consume a forced
shared CSS-only chunk, while each shadow entrypoint also loads its own initial and lazy styles.

The primary entrypoint mounts two roots, starts one `import()` before the first root exists, watches
for anchor replacement, and registers a local WOFF2 through `shadow.fonts`. The secondary entrypoint
has an independent runtime registry and lazy chunk. The ordinary entrypoint proves that shared CSS
continues to load through `content_scripts.css` outside Shadow DOM.

## What the runner verifies

- Shadow entrypoints have no manifest-level CSS; their initial, lazy and shared CSS files are in web
  accessible resources.
- The ordinary entrypoint retains manifest-level CSS, including the shared chunk.
- No content entrypoint receives a background file.
- Every root contains file-backed extension `<link>` elements and receives initial and requested lazy
  styles without leaking selectors into the page.
- An import issued before the first root completes, and later roots receive already requested styles.
- Removing and recreating an anchor produces a new host, ShadowRoot, render target and stylesheet
  links.
- Top documents and same-origin child iframes work with and without strict page CSP.
- Two shadow entrypoints sharing CSS keep independent root registries.
- The local font is really rendered: the synthetic `AAAA` sample is measured at 320px. Merely seeing
  its `font-family` value is not accepted.

The strict page response uses:

```text
default-src 'none'; style-src 'none'; style-src-elem 'none'; font-src 'none'; frame-src 'self'; img-src 'self'
```

Passing results were reproduced on Chrome 155.0.8041.0 with Manifest V3 and Firefox 155.0 with
Manifest V2 and Manifest V3. Reports are written to
`.cache/integration/shadow-styles-<browser>-mv<version>.json`, outside the extension output.

## Run

From the repository root:

```sh
npm run build
npx jest tests/integration/browser/content/shadow-styles.integration.test.ts --runInBand
npx jest tests/integration/browser/content/shadow-styles.firefox.integration.test.ts --runInBand
```

Set `ADNBN_CHROME_BIN` or `ADNBN_FIREFOX_BIN` when automatic browser discovery selects the wrong
binary. The source fixture keeps the local font beside the primary entrypoint. `font.py` documents how
the synthetic font was produced; FontTools and Brotli are not needed to build or run the test.

The feature contract is documented in [`src/entry/content/README.md`](../../../../../src/entry/content/README.md).
