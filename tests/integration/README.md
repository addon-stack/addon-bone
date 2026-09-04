# Integration tests

These tests build local Addon Bone applications through the public CLI. Build checks live in `build`; tests that launch Chrome or Firefox live in `browser`. Each area keeps its test beside the application scenarios it uses.

## Layout

```text
tests/integration/
├── build/options/
│   ├── options.integration.test.ts
│   └── embedded/
├── browser/
│   ├── content/
│   │   ├── entrypoint-assets.integration.test.ts
│   │   ├── entrypoint-assets.firefox.integration.test.ts
│   │   ├── utils.ts
│   │   ├── entrypoint-assets/
│   │   ├── shadow-styles.integration.test.ts
│   │   ├── shadow-styles.firefox.integration.test.ts
│   │   ├── shadow-styles-utils.ts
│   │   └── shadow-styles/
│   ├── offscreen/
│   │   ├── service.integration.test.ts
│   │   └── service/
│   ├── options/
│   │   ├── options.integration.test.ts
│   │   ├── react/
│   │   └── vanilla/
│   └── utils/
│       ├── BidiClient.ts
│       ├── browser.ts
│       ├── chrome.ts
│       ├── firefox.ts
│       └── site.ts
├── utils/
│   ├── fixture.ts
│   └── process.ts
├── prepare.ts
└── typecheck.ts
```

Use kebab-case for directory names and for filenames containing multiple words, including helpers and scenario tests. Files whose primary export is a class or React component use PascalCase matching that export. Tests for a specific class also preserve its name, for example `ContentManager.test.ts`. Keep framework entrypoint suffixes such as `.content.ts` and `.page.ts`. Put an entrypoint or component with its own styles in one directory; standalone entrypoints can remain single files.

Each application retains its own `package.json`, `adnbn.config.ts`, and `tsconfig.json`. The package boundary prevents the framework package's `sideEffects: false` setting from discarding fixture CSS imports.

## Prepare the editor environment

Install dependencies once at the repository root, then run:

```bash
npm run prepare:integration
```

This builds the framework, links each fixture's declared dependencies to the local framework or root `node_modules`, and builds all six applications. The generated `.adnbn` configuration and declarations remain beside their sources, so the editor can resolve `adnbn`, virtual imports such as `adnbn/browser`, CSS/SVG modules, and generated transport contracts.

No separate install or lockfile is needed in each fixture. Dependency versions come from the root installation. Preparation can be repeated; matching links are reused, while conflicting existing dependency locations produce an error instead of being overwritten.

The generated `.adnbn`, `node_modules`, and `dist` directories are ignored by Git. Rerun preparation after changing framework APIs or fixture entrypoints and contracts.

To prepare and typecheck every fixture, including its configuration:

```bash
npm run typecheck:integration
```

The root `typecheck` checks framework and test-runner code; `typecheck:integration` additionally checks the fixture applications against their generated declarations. CI runs both.

## Run tests

Run these commands from the repository root:

```bash
npm run test:integration
npm run test:integration:build
npm run test:chrome
npm run test:firefox
```

They run all integration tests, only build checks, only Chrome checks, or only Firefox checks respectively. Each command builds the framework first. Browser tests require Chrome with `Extensions.loadUnpacked` support and Firefox with WebDriver BiDi `webExtension.install` support. Set `ADNBN_CHROME_BIN` or `ADNBN_FIREFOX_BIN` to the browser's absolute executable path if automatic discovery selects the wrong browser. Node must provide the built-in `WebSocket` API. CI installs both browsers on Linux; Windows runs the non-browser suite.

Tests copy application inputs to unique directories under `.cache/integration`. Prepared dependencies and generated files are excluded from the copy and recreated there. Cleanup removes only the run's copy and temporary Chrome profile; it does not remove the editor environment in the source fixture or change the `addon` playground.

## Coverage

- `build/options/embedded`: ten manifest checks covering explicit `openInTab: false` across Chrome, Edge, Opera, Safari, and Firefox in MV2 and MV3. No browser is launched.
- `browser/options`: two Chrome MV3 cases covering Vanilla and React rendering, CSS, state/events, opening Options from background, and a View chunk shared with a Page.
- `browser/offscreen/service`: one Chrome MV3 round trip from background through Offscreen to a registered background service.
- `browser/content/entrypoint-assets`: one Chrome MV3 case and two Firefox cases (MV2 and MV3) using the same application and probe assertions. They cover current asset getters, rejecting the full-map getter outside background, common chunks, dynamic imports, CSS/SVG resource URLs, world separation, and top/child frames. The Chrome case also reads the full-map readiness flag in background.
- `browser/content/shadow-styles`: production Shadow DOM coverage in Chrome MV3 and Firefox MV2/MV3. Two shadow entrypoints and one ordinary entrypoint verify file-backed initial/lazy/shared CSS, independent runtime registries, strict CSP, local `FontFace` registration, watch-driven remount, top documents, and child iframes. The shared CSS remains manifest CSS for the ordinary consumer and a web accessible resource for the shadow consumers.

In MV3, ISOLATED retains physical async chunks and MAIN includes dynamic dependencies in its initial graph. In Addon Bone's MV2 pipeline, every content entry uses ISOLATED, including entries requesting MAIN. Such requests emit a build warning before entrypoint grouping; the runtime test verifies async JS/CSS and the absence of page-visible globals for the downgraded entries. This is a framework policy, not a claim that all Firefox versions lack native MAIN support in MV2.

Browser execution covers the installed Chrome in MV3 and Firefox in MV2/MV3. It does not certify older browser versions. Building other browser targets does not verify their runtime behavior.

## The content test site

`browser/content/entrypoint-assets/site` is the ordinary website receiving the content scripts, not an extension entrypoint. A local HTTP server serves `top.html`, `frames.html`, and `child.html` with a restrictive CSP: `default-src 'none'; frame-src 'self'; img-src 'self'`. Same-origin image requests allow the browser's automatic favicon request, which receives an empty 204 response; scripts and styles remain restricted by `default-src`. The frame pages exercise `allFrames` and independent execution in the top document and its child iframe.

Keep these HTML files outside the application's `src` directory. They need no separate package or build tool. The server uses an ephemeral loopback port and stops after the test.
