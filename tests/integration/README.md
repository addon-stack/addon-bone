# Integration tests

These tests cover application builds, browser execution, and generated TypeScript contracts. Build checks through the CLI and the built package live in `build`; tests that launch Chrome or Firefox live in `browser`; declaration and consumer type checks live in `types`. Each area keeps its tests beside their fixtures.

## Layout

Selected scenario files and shared infrastructure:

```text
tests/integration/
├── build/
│   ├── cli/
│   │   ├── cli.integration.test.ts
│   │   ├── build-api.integration.test.ts
│   │   ├── dotenv.integration.test.ts
│   │   ├── BuildSession.integration.test.ts
│   │   ├── root-dir.integration.test.ts
│   │   ├── fixtures/
│   │   │   ├── build-session/
│   │   │   ├── exit-code/
│   │   │   ├── environment/
│   │   │   ├── dotenv/
│   │   │   ├── root-dir/
│   │   │   └── root-dir-b/
│   │   └── scripts/
│   ├── html/
│   │   ├── html.integration.test.ts
│   │   ├── fixture/
│   │   └── scenarios/
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
│   │   ├── newtab.integration.test.ts
│   │   ├── bookmarks.integration.test.ts
│   │   ├── history.integration.test.ts
│   │   ├── competing.integration.test.ts
│   │   ├── override-utils.ts
│   │   ├── newtab/
│   │   ├── bookmarks/
│   │   └── history/
│   ├── permissions/
│   │   ├── permissions.integration.test.ts
│   │   └── views/
│   ├── style/
│   │   ├── style-merge.integration.test.ts
│   │   ├── module-resolution.integration.test.ts
│   │   ├── font-reuse.integration.test.ts
│   │   ├── virtual-style.integration.test.ts
│   │   ├── compiler.ts
│   │   └── fixtures/
│   │       ├── bare-module-watch/
│   │       ├── bare-module-watch-updates/
│   │       ├── relative-module-watch-updates/
│   │       ├── font-reuse/
│   │       ├── multi-app/
│   │       ├── multi-app-updates/
│   │       ├── virtual-theme/
│   │       └── virtual-theme-updates/
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
│   ├── html.integration.test.ts
│   ├── registries.integration.test.ts
│   ├── relay.integration.test.ts
│   ├── view.integration.test.ts
│   └── fixtures/
│       ├── content/
│       ├── html/
│       ├── registries/
│       ├── relay/
│       └── view/
├── utils/
│   ├── fixture.ts
│   ├── fixture.test.ts
│   ├── process.ts
│   ├── process.test.ts
│   ├── queue.ts
│   └── queue.test.ts
├── prepare.ts
└── typecheck.ts
```

Use kebab-case for directory names and for filenames containing multiple words, including helpers and scenario tests. Files whose primary export is a class or React component use PascalCase matching that export. Tests for a specific class also preserve its name, for example `ContentManager.test.ts`. Keep framework entrypoint suffixes such as `.content.ts` and `.page.ts`. Put an entrypoint or component with its own styles in one directory; standalone entrypoints can remain single files.

The preparation/typecheck inventory recognizes standalone applications by both `adnbn.config.ts` and
`package.json`. Internal CLI configuration fixtures are exercised by their owning tests and are not prepared
as consumer applications. Each application retains its own `package.json`, `adnbn.config.ts`, and `tsconfig.json`. The package boundary prevents the framework package's `sideEffects: false` setting from discarding fixture CSS imports.

## Prepare the editor environment

Install dependencies once at the repository root, then run:

```bash
npm run fixtures:prepare
```

This builds the framework, links each fixture's declared dependencies to the local framework or root `node_modules`, and builds all fixture applications. The generated `.adnbn` configuration and declarations remain beside their sources, so the editor can resolve `adnbn`, virtual imports such as `adnbn/browser`, CSS/SVG modules, and generated transport contracts.

No separate install or lockfile is needed in each fixture. Dependency versions come from the root installation. Preparation can be repeated; matching links are reused, while conflicting existing dependency locations produce an error instead of being overwritten.

The generated `.adnbn`, `node_modules`, and `dist` directories are ignored by Git. Rerun preparation after changing framework APIs or fixture entrypoints and contracts.

To prepare and typecheck every fixture, including its configuration:

```bash
npm run typecheck:fixtures
```

The root `typecheck` checks framework and test-runner code; `typecheck:fixtures` additionally checks the fixture applications against their generated declarations. CI runs both.

The fixtures in `types` are checked by their Jest tests with isolated TypeScript programs against source and built package APIs. They do not have application configs and are not part of `fixtures:prepare` or `typecheck:fixtures`.

## Run tests

Run these commands from the repository root:

```bash
npm run test:build
npm run test:types
npm run test:browser
npm run test:browser:chrome
npm run test:browser:firefox
```

These commands run build integrations, declaration tests, both browsers, or an individual browser respectively. Each command builds the framework first. Browser tests require Chrome with `Extensions.loadUnpacked` support and Firefox with WebDriver BiDi `webExtension.install` support. Set `ADNBN_CHROME_BIN` or `ADNBN_FIREFOX_BIN` to the browser's absolute executable path if automatic discovery selects the wrong browser. Node must provide the built-in `WebSocket` API. CI installs both browsers on Linux; Windows runs the non-browser suite.

These groups run test files in parallel, with up to eight workers by default (one fewer than the available CPUs on smaller machines). Pass `-- --maxWorkers=N` to tune the pool. Preparation and fixture typechecks run up to four independent applications concurrently; `ADNBN_TEST_WORKERS` overrides that limit. See [the test guide](../README.md) for project selection, hooks, coverage and the complete validation commands.

Tests copy application inputs to unique directories under `.cache/integration`. Prepared dependencies and generated files are excluded from the copy and recreated there. Cleanup removes only the run's copy and temporary Chrome profile; it does not remove the editor environment in the source fixture or change the `addon` playground.

### Browser startup

Every browser integration uses `startBrowserSession` in `browser/utils/session.ts`. It owns the browser process,
protocol connection and profile cleanup, including failed startup. The default `startupTimeout` is 30 seconds:
one budget from spawning the process through Chrome's `Browser.getVersion` or Firefox's `session.new` response.
The Chrome HTTP probe is limited to the smaller of five seconds and the remaining budget; protocol connection
attempts and readiness requests also use the remaining budget. Extension installation and page readiness are
separate operations. Scenario `waitFor` calls retain their 15-second default and test deadlines are unchanged.

Tests that manage multiple targets use `{createPage: false}` and the session's `chrome` or `firefox` client,
`port` and `extensionId`. Firefox subscriptions needed before extension installation go in `firefoxEvents`.
Always close the session in `finally`; its `output` getter supplies browser stderr for failure diagnostics.

The Jest reporter writes `.cache/integration/browser-startup.json` after each run. It contains per-start test
names, files, durations and failures, plus successful-start median, nearest-rank p95 and maximum per browser.
Durations exclude binary discovery, profile allocation, extension installation and cleanup. A successful startup
does not imply that extension installation or the test passed. CI uploads this report even when browser tests fail.
For comparison runs, set `ADNBN_BROWSER_STARTUP_REPORT` to distinct output paths; the default file describes only
the latest completed Jest invocation, including an empty report when it starts no browsers. Collection uses
buffered console diagnostics, so keep the default `--verbose=false` and do not pass Jest `--silent` when measuring startup. An interrupted/killed Jest
worker may not deliver its diagnostics. Use repeated CI reports to assess distributions and failure frequency;
a larger timeout or one green local run does not establish stability.

## Coverage

The one-shot build lifecycle is checked with real Rspack compilers in `src/cli/builders/app/build.test.ts`.
`build` returns `Stats` only after compiler shutdown and attempts `close` after compilation errors too.
`BuildError` retains available statistics and the original cause; simultaneous compilation and close failures
are both retained in an `AggregateError` cause. A close failure is reported, not treated as successful cleanup.
The CLI owns statistics formatting, colors and the exit code. `build/cli/cli.integration.test.ts` launches the
real CLI to check exit codes, diagnostics and shutdown before success output. `build-api.integration.test.ts`
checks the built app API, including awaiting shutdown without printing statistics. Their application fixtures
live in `build/cli/fixtures`; Node subprocess drivers live in `build/cli/scripts`. These tests deliberately load
`dist` to exercise Node's real module/config loader. The source-level `build.test.ts` above imports `./build`
directly and has no dependency on `dist`. Watch still has a separate lifecycle and
remains covered through the CLI, including `isolation-watch`.

The internal `buildApp(config): Promise<Stats>` entry in `src/cli/builders/app/index.ts` is a sequential
one-shot pilot. It snapshots the existing `process.env` object before config resolution and restores its values
and identity in `finally`, including added, changed and deleted keys. Config, startup, bundler, compilation and
shutdown hooks see the build environment until compiler shutdown settles. A second `buildApp` call rejects
before reading config or modifying the active build's environment, including while shutdown is pending.

This is a transitional environment transaction, not process isolation. Do not mix it with watch, direct calls
to the config resolver, or unrelated asynchronous work that writes `process.env`. Plugins must await their own
work; detached tasks, module caches and other global state are not restored. The CLI and integration fixtures
continue to use their existing process boundary; watch is outside the pilot.

`build/cli/build-api.integration.test.ts` exercises real builds with TypeScript configs: A → B → A after a dotenv change, observations
inside config and plugin hooks, concurrent-call rejection at startup and shutdown, and recovery after config,
startup, bundler, run, compilation and close failures. The pilot accepts only `.ts`, `.mts` and `.cts` configs;
other formats reject before config execution. Native JS configs may retain evaluated exports in Node's module
cache across builds; environment restoration alone does not refresh them. Use the ordinary CLI for those
projects. This restriction belongs only to `buildApp`, not the CLI. Repeated builds are checked for all three
TypeScript extensions; imported native modules still retain their normal Node cache semantics.

`build/cli/root-dir.integration.test.ts` builds two projects in the sequence A → B → A through both the CLI
and `buildApp`, from an unrelated working directory. Absolute roots, paths containing spaces, relative
imports and the generated `@/` alias are covered. Compiler context, source aliases and fallback package
resolution use the project root; the caller's working directory is unchanged. The external virtual-module
plugin still creates temporary files under the caller's `node_modules` and removes its module directory on
compiler shutdown; these builds therefore require a writable working directory. The sequence includes
Chrome and Firefox with Offscreen, including its generated background module.

The external plugin does not isolate overlapping builds sharing a cwd: closing one compiler can remove
another compiler's virtual modules. This remains an upstream limitation, not a supported concurrency contract.
After `npm run build`, run `node tests/benchmarks/virtual-module-conflict.mjs` to reproduce the controlled
creation/close race. The diagnostic expects the second build to fail and is deliberately outside Jest.
Parallel test sessions use distinct working directories; production directory naming is unchanged.

- `types/content`: shared Content and adapter render types through the public source and built package APIs, callback props inference, and iframe-navigation restrictions for both define functions.
- [types/html.integration.test.ts](types/html.integration.test.ts): static entrypoint options, configuration callbacks, object metadata, and rejected string metadata through both source and built declarations. Fixtures live in `types/fixtures/html`.
- `types/view`: shared View and adapter render types through the public source and built package APIs, render and container props inference, the render contract adopted by Offscreen and Sandbox, and the rejection of Promise and plain-object render values.
- `types/registries`: generated registry augmentation, empty fallbacks, public and internal type agreement, and message contracts against source and built package APIs. Compiler-host path checks cover both slash styles.
- [build/html](build/html): emitted metadata and asset tags, all four `config.html` forms, page-specific tag selection, and representative failures from configuration, entrypoint parsing, and plugin validation. Invalid inputs live in its own `scenarios` directory. Parser field matrices belong beside `ViewParser`; validation rules owned by `@rspackjs/plugin-html-tags` belong in that package's tests. No browser is launched.
- `build/options/embedded`: ten manifest checks covering explicit `openInTab: false` across Chrome, Edge, Opera, Safari, and Firefox in MV2 and MV3. No browser is launched.
- `browser/view`: one Chrome MV3 case covering React offscreen and sandbox views rendered by the injected builder with their props and titles, a headless offscreen without a view container, and strings rendered as text by the React view, Vanilla view and React content adapters.
- `browser/options`: two Chrome MV3 cases covering Vanilla and React rendering, CSS, state/events, opening Options from background, and a View chunk shared with a Page.
- `build/override`: separate New Tab, Bookmarks, History and competing-entrypoint files let Jest schedule the scenarios across workers. The files share assertions, while each case keeps its own application copy and build. Thirty manifest checks cover the New Tab, Bookmarks, and History applications across Chrome, Edge, Opera, Safari, and Firefox in MV2 and MV3. Supporting browsers receive `chrome_url_overrides`, the page HTML, its CSP, and the permission declared by the entrypoint; the others receive none of them. Three more cases add the History entrypoint to a copy of the New Tab application: Chrome and Edge builds fail naming both entrypoints, while Firefox keeps the New Tab with its own permission and without the History one. No browser is launched.
- `build/permissions/views`: four manifest checks of one application with two popups, two sidebars, and an options page that each declare permissions. Every built view contributes, including a popup and a sidebar that are not applied by default; Chrome MV2 has no sidebar, so its permissions are not requested; Firefox builds the sidebar action without `sidePanel`; MV2 declares hosts as permissions. No browser is launched.
- `build/style`: shared and app stylesheet merging with `mergeStyles` through the production style and asset rules. Two applications with the same layout and different fonts each receive one CSS module per destination, the same class identifier in ordinary and `?unisolated` output, and their own font. Tests cover resources declared in partials, passed through `with`, and reused through a complete font-face mixin; standalone styles with merging disabled; and production/development source maps. Generated styles exercise aliases, `?asis`, and an existing external `resolve-url-loader`. A native Node build checks the built framework and ESM loader. App overrides with a namespace conflict, a missing module, or invalid SCSS fail the build. Watch mode tracks override creation, edits, imported partials, resources, removal, recreation, the appearance of a local module for a bare Sass request, and recovery after creating a missing module for an explicit relative request. No browser is launched.
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

## Build environment contract

Only the framework loads dotenv files. Within each directory it reads, in order:
`.env.<mode>.<browser>.local`, `.env.<mode>.<browser>`, `.env.<browser>.local`, `.env.<browser>`,
`.env.<mode>.local`, `.env.<mode>`, `.env.local`, `.env`. It reads all eight names in the app source
directory first, then the app directory, then the project root. The first file value wins.
Existing process variables take precedence in the host process; `APP`, `BROWSER`, `MODE`, and
`MANIFEST_VERSION` are always replaced with the current build target.

Loading happens before the user config executes and again after its overrides are applied. On the second
pass, existing host variables remain, but newly selected file values replace earlier values for the bundled
`process.env` substitution. The bundle receives filtered file values and the four reserved values, not a copy
of the host environment. `${VAR}` references remain literal; the framework does not interpolate dotenv values.
`build/cli/dotenv.integration.test.ts` verifies both host values and actual Rspack substitution.

The extra dotenv pass in `c12` is disabled. **Behavior change:** running the CLI from a directory outside the
project no longer reads that directory's `.env`, and its interpolated values no longer reach user config or
plugins. Put build variables in the app/project dotenv files or export them explicitly in the calling process.

## Override build-session pilot

Override page tests can select `ADNBN_OVERRIDE_BUILD_MODE=session`; the default is `cli`.
Each page test file owns one child Node process through `BuildSession`. The process loads the built package
once and handles its ten builds sequentially. Application copies, scenario names and assertions are unchanged;
the three competing-entrypoint scenarios always use the CLI.

The session has a private, fixed cwd and receives absolute fixture roots. Its environment is copied for each
request and restored inside the child. Jest's environment, cwd and loader are never replaced. Neither concurrent
requests nor automatic retries are supported. Errors preserve their message, cause chain and compiler diagnostics.
The parent owns the deadline, kills a timed-out process, and waits for `close` before rejecting the request.
Normal disposal asks the child to exit, waits for `close`, and removes the session directory. If the owner dies,
the child's IPC `disconnect` handler exits immediately, even during a pending build. An abrupt owner death may
leave a temporary directory, but must not leave a running build process.

```bash
npm run build
npx cross-env ADNBN_OVERRIDE_BUILD_MODE=session npm run test:run -- --selectProjects build --testPathPatterns=tests/integration/build/override --maxWorkers=2
node tests/benchmarks/override-pilot.mjs
```

The child exits after each file, bounding compiler retention to that file's builds. This does not fix Rspack's
retention or establish a peak-memory bound. The benchmark compares two/eight workers, records child PID,
heap/RSS and peak RSS after each build, checks the same 33 scenario names, and verifies process and directory
cleanup. With three session-backed files there are at most three build children, even with eight Jest workers.
Run benchmarks exclusively, without another build or test run.

See the [session measurements](../benchmarks/2026-09-28-override-session.md) for timings and child memory.
The [earlier in-process report](../benchmarks/2026-09-28-override-pilot.md) describes the superseded experiment;
its timings do not apply to the session backend. CI explicitly runs the session override suite on Linux and
Windows with Node 22 and 24, after the ordinary CLI build integrations, using two workers. This reuses the
existing package build and does not replace the CLI coverage run. The local default remains CLI; switching
it requires successful CI results and fresh measurements on the target machines.
