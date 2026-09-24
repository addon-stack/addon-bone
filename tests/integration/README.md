# Integration tests

These tests cover application builds, browser execution, and generated TypeScript contracts. Build checks through the public CLI live in `build`; tests that launch Chrome or Firefox live in `browser`; declaration and consumer type checks live in `types`. Each area keeps its tests beside their fixtures.

## Layout

Selected scenario files and shared infrastructure:

```text
tests/integration/
├── build/
│   ├── locale/
│   │   ├── locale.integration.test.ts
│   │   ├── dynamic.integration.test.ts
│   │   ├── chunks.integration.test.ts
│   │   ├── chunks-threshold.integration.test.ts
│   │   ├── chunks-disabled.integration.test.ts
│   │   ├── chunks-utils.ts
│   │   ├── fixture/
│   │   ├── dynamic-fixture/
│   │   └── chunks-fixture/
│   ├── options/
│   │   ├── options.integration.test.ts
│   │   └── embedded/
│   ├── override/
│   │   ├── override.integration.test.ts
│   │   ├── newtab/
│   │   ├── bookmarks/
│   │   └── history/
│   ├── permissions/
│   │   ├── permissions.integration.test.ts
│   │   └── views/
│   └── …
├── browser/
│   ├── relay/
│   │   ├── scripting.integration.test.ts
│   │   ├── scripting.firefox.integration.test.ts
│   │   ├── scripting-utils.ts
│   │   └── scripting/
│   ├── content/
│   │   ├── entrypoint-assets.integration.test.ts
│   │   ├── entrypoint-assets.firefox.integration.test.ts
│   │   ├── entrypoint-assets/
│   │   ├── isolated-styles-utils.ts
│   │   ├── isolation-shadow.integration.test.ts
│   │   ├── isolation-shadow-mv2.firefox.integration.test.ts
│   │   ├── isolation-shadow-mv3.firefox.integration.test.ts
│   │   ├── isolation-shadow/
│   │   ├── isolation-iframe.integration.test.ts
│   │   ├── isolation-iframe.firefox.integration.test.ts
│   │   ├── isolation-iframe/
│   │   ├── relay-styles.integration.test.ts
│   │   ├── relay-styles.firefox.integration.test.ts
│   │   ├── relay-styles-utils.ts
│   │   ├── relay-styles/
│   │   └── …
│   ├── locale/
│   ├── offscreen/
│   ├── options/
│   ├── override/
│   ├── view/
│   └── utils/
│       ├── BidiClient.ts
│       ├── CdpClient.ts
│       ├── browser.ts
│       ├── browser.test.ts
│       ├── chrome.ts
│       ├── firefox.ts
│       └── …
├── types/
│   ├── content.integration.test.ts
│   ├── registries.integration.test.ts
│   ├── view.integration.test.ts
│   └── fixtures/
│       ├── content/
│       ├── registries/
│       └── view/
├── utils/
│   ├── fixture.ts
│   ├── process.ts
│   ├── process.test.ts
│   ├── queue.ts
│   └── queue.test.ts
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

This builds the framework, links each fixture's declared dependencies to the local framework or root `node_modules`, and builds all fixture applications. The generated `.adnbn` configuration and declarations remain beside their sources, so the editor can resolve `adnbn`, virtual imports such as `adnbn/browser`, CSS/SVG modules, and generated transport contracts.

No separate install or lockfile is needed in each fixture. Dependency versions come from the root installation. Preparation can be repeated; matching links are reused, while conflicting existing dependency locations produce an error instead of being overwritten.

The generated `.adnbn`, `node_modules`, and `dist` directories are ignored by Git. Rerun preparation after changing framework APIs or fixture entrypoints and contracts.

To prepare and typecheck every fixture, including its configuration:

```bash
npm run typecheck:integration
```

The root `typecheck` checks framework and test-runner code; `typecheck:integration` additionally checks the fixture applications against their generated declarations. CI runs both.

The fixtures in `types` are checked by their Jest tests with isolated TypeScript programs against source and built package APIs. They do not have application configs and are not part of `prepare:integration` or `typecheck:integration`.

## Run tests

Run these commands from the repository root:

```bash
npm run test:integration
npm run test:integration:build
npm run test:chrome
npm run test:firefox
```

They run all integration tests, only build checks, only Chrome checks, or only Firefox checks respectively. Each command builds the framework first. Browser tests require Chrome with `Extensions.loadUnpacked` support and Firefox with WebDriver BiDi `webExtension.install` support. Set `ADNBN_CHROME_BIN` or `ADNBN_FIREFOX_BIN` to the browser's absolute executable path if automatic discovery selects the wrong browser. Node must provide the built-in `WebSocket` API. CI installs both browsers on Linux; Windows runs the non-browser suite.

These groups run test files in parallel, with up to eight workers by default (one fewer than the available CPUs on smaller machines). Pass `-- --maxWorkers=N` to tune the pool. Preparation and fixture typechecks run up to four independent applications concurrently; `ADNBN_TEST_WORKERS` overrides that limit. See [the test guide](../README.md) for project selection, hooks, coverage and the complete validation commands.

Tests copy application inputs to unique directories under `.cache/integration`. Prepared dependencies and generated files are excluded from the copy and recreated there. Cleanup removes only the run's copy and temporary Chrome profile; it does not remove the editor environment in the source fixture or change the `addon` playground.

## Coverage

- `types/content`: shared Content and adapter render types through the public source and built package APIs, callback props inference, and iframe-navigation restrictions for both define functions.
- `types/view`: shared View and adapter render types through the public source and built package APIs, render and container props inference, the render contract adopted by Offscreen and Sandbox, and the rejection of Promise and plain-object render values.
- `types/registries`: generated registry augmentation, empty fallbacks, public and internal type agreement, and message contracts against source and built package APIs. Compiler-host path checks cover both slash styles.
- `build/options/embedded`: ten manifest checks covering explicit `openInTab: false` across Chrome, Edge, Opera, Safari, and Firefox in MV2 and MV3. No browser is launched.
- `browser/view`: one Chrome MV3 case covering React offscreen and sandbox views rendered by the injected builder with their props and titles, a headless offscreen without a view container, and strings rendered as text by the React view, Vanilla view and React content adapters.
- `browser/options`: two Chrome MV3 cases covering Vanilla and React rendering, CSS, state/events, opening Options from background, and a View chunk shared with a Page.
- `build/override`: thirty manifest checks covering the New Tab, Bookmarks, and History applications across Chrome, Edge, Opera, Safari, and Firefox in MV2 and MV3. Supporting browsers receive `chrome_url_overrides`, the page HTML, its CSP, and the permission declared by the entrypoint; the others receive none of them. Three more cases add the History entrypoint to a copy of the New Tab application: Chrome and Edge builds fail naming both entrypoints, while Firefox keeps the New Tab with its own permission and without the History one. No browser is launched.
- `build/permissions/views`: four manifest checks of one application with two popups, two sidebars, and an options page that each declare permissions. Every built view contributes, including a popup and a sidebar that are not applied by default; Chrome MV2 has no sidebar, so its permissions are not requested; Firefox builds the sidebar action without `sidePanel`; MV2 declares hosts as permissions. No browser is launched.
- `browser/override`: three Chrome MV3 cases opening `chrome://newtab`, `chrome://bookmarks`, and `chrome://history`. They verify that Chrome serves the extension page, React and Vanilla rendering, CSS, state/events, custom `as` and `htmlDir` naming, and a View chunk shared with a Page.
- `browser/offscreen/service`: one Chrome MV3 round trip from background through Offscreen to a registered background service.
- `browser/content/entrypoint-assets`: one Chrome MV3 case and two Firefox cases (MV2 and MV3) using the same application and probe assertions. They cover current asset getters, rejecting the full-map getter outside background, common chunks, dynamic imports, CSS/SVG resource URLs, world separation, and top/child frames. The Chrome case also reads the full-map readiness flag in background.
- `browser/content/isolation-shadow`: production Shadow DOM coverage in Chrome MV3 and Firefox MV2/MV3. Two shadow entrypoints and one ordinary entrypoint verify file-backed initial/lazy/shared CSS, independent runtime registries, strict CSP, local fonts declared with CSS `@font-face`, watch-driven remount, top documents, and child iframes. The shared CSS remains manifest CSS for the ordinary consumer and a web accessible resource for the shadow consumers.
- `browser/content/isolation-iframe`: production blank-iframe coverage in the same browser matrix. React and Vanilla renderers verify initial/lazy/shared CSS, local CSS fonts, strict CSP, and recovery after moving or detaching a host, including while its initial styles are loading.

In MV3, ISOLATED retains physical async chunks and MAIN includes dynamic dependencies in its initial graph. In Addon Bone's MV2 pipeline, every content entry uses ISOLATED, including entries requesting MAIN. Such requests emit a build warning before entrypoint grouping; the runtime test verifies async JS/CSS and the absence of page-visible globals for the downgraded entries. This is a framework policy, not a claim that all Firefox versions lack native MAIN support in MV2.

Browser execution covers the installed Chrome in MV3 and Firefox in MV2/MV3. It does not certify older browser versions. Building other browser targets does not verify their runtime behavior.

## The content test site

`browser/content/entrypoint-assets/site` is the ordinary website receiving the content scripts, not an extension entrypoint. A local HTTP server serves `top.html`, `frames.html`, and `child.html` with a restrictive CSP: `default-src 'none'; frame-src 'self'; img-src 'self'`. Same-origin image requests allow the browser's automatic favicon request, which receives an empty 204 response; scripts and styles remain restricted by `default-src`. The frame pages exercise `allFrames` and independent execution in the top document and its child iframe.

Keep these HTML files outside the application's `src` directory. They need no separate package or build tool. The server uses an ephemeral loopback port and stops after the test.

- `browser/relay/scripting`: Chrome MV3 and Firefox MV2/MV3 check real Relay scripting success, undefined/null results, remote errors, immediate missing-manager errors and exhausted retries (#109).
