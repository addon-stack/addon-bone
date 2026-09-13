# Iframe feasibility probe

This small esbuild extension establishes browser behavior independently of the production iframe
node. It uses the real context mount lifecycle with a probe node. React/Vanilla, file CSS, CSS
font-face, strict CSP, and host movement are measured in Chrome MV3 and Firefox
MV2/MV3. Font use is proven by text width.

The site also serves allowed, CSP-blocked and X-Frame-Options-blocked embedding destinations.
MAIN and ISOLATED use distinct physical test entry files. Reports are saved outside extension
output in `.cache/integration/isolation-spike-*.json`.

```sh
npm run build
npx jest --testPathPatterns=isolation-spike --runInBand
```

## Pending stylesheet regression (2026-09-08)

The first host move now runs synchronously immediately after `context.mount()`, before any initial
CSS load callback can run. The harness requires generation 2 before accepting the initial result.
Previously, a WebDriver command issued after navigation could run before the content script existed
(moving nothing) or after its resources had loaded. A passing run did not prove the pending-load case.

Before recovery retries were added, Chrome 155.0.8046.0 passed this deterministic scenario while
Firefox 155.0.1 failed in both MV2 and MV3.
Gecko's `nsCSSLoader` trace shows the new document joining the still-loading `initial.css` request;
that shared request then completes with `0x804b0002` (`NS_BINDING_ABORTED`) after the old iframe
document is discarded. This reproduces without page CSP and without any production bundler plugins.
The production `isolation` fixture also reproduces it when its first Mount immediately moves its host:
the target is recreated, but its CSS fails to apply. Clearing old link handlers alone does not fix it.

The agreed recovery behavior allows one retry of a failed stylesheet when rebuilding the iframe
document. Both attempts share the original timeout; a second error or timeout remains a failure.
The probe applies this rule to initial CSS when its generation is greater than 1 and cancels pending
work when that document is replaced. Later lazy requests do not inherit the retry policy.
The production fixture exercises the same case through `FrameNode` and the isolated styles runtime.
A link error does not expose Gecko's internal cancellation status to JavaScript, so the retry cannot
identify cancellation alone. No delays, cache-busting URLs, text stylesheets, or skipped assertions
are used.

With this recovery rule, both the probe and production iframe tests pass in Chrome 155.0.8046.0
MV3 and Firefox 155.0.1 MV2/MV3, including strict CSP and measured font use.

To reproduce the browser's loader diagnostics on macOS/Linux:

```sh
MOZ_LOG=nsCSSLoader:5 MOZ_LOG_FILE=/tmp/adnbn-iframe-css.log \
  npx jest --runInBand --runTestsByPath \
  tests/integration/browser/content/isolation-spike.firefox.integration.test.ts
```

Mozilla defines the cancellation result in
[ErrorList.py](https://github.com/mozilla/gecko-dev/blob/master/xpcom/base/ErrorList.py)
and implements stylesheet request coalescing in
[Loader.cpp](https://github.com/mozilla/gecko-dev/blob/master/layout/style/Loader.cpp).
