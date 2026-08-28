# Options integration fixtures

Run from the repository root after installing its dependencies:

```bash
npm run build
node ./node_modules/jest/bin/jest.js tests/integration/browser/options.integration.test.ts --runInBand
```

The test builds the local framework fixtures, loads each browser fixture in an isolated Chrome profile through CDP, and calls `chrome.runtime.openOptionsPage()` from its real background service worker. Set `ADNBN_CHROME_BIN` to an absolute Chrome executable path if automatic discovery selects the wrong browser. Chrome must support `Extensions.loadUnpacked`; Node must provide the built-in `WebSocket` API.

| Fixture    | Coverage                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `vanilla`  | `options.ts`, default `openInTab: true`, DOM rendering and event handling                                          |
| `react`    | `options.tsx`, explicit `openInTab: true`, React rendering and state, custom `as` and `htmlDir`                    |
| `embedded` | Build-only verification that explicit `openInTab: false` reaches the manifest for all five browsers in MV2 and MV3 |

The two browser cases check the exact `options_ui` object, the absence of `options_page`, loading of the common View chunk shared with a second Page, CSS application, and runtime errors. Their expected output paths are `options.html` and `ui/preferences.options.html` inside each fixture's `dist/myapp-chrome-mv3` directory.

The suite creates temporary package links, generated files, build output, and Chrome profiles, then removes them. It does not use your regular browser profile or modify the `addon` playground.

Each fixture has its own package boundary so it does not inherit the framework
package's `sideEffects: false` and lose CSS imports during production builds.

To run only the embedded manifest build without launching Chrome:

```bash
node ./node_modules/jest/bin/jest.js tests/integration/browser/options.integration.test.ts --runInBand -t "preserves explicit"
```

Browser execution covers Chrome MV3. The `embedded` cases build Chrome, Edge, Opera, Safari, and Firefox targets in MV2 and MV3; they do not test embedded settings UI. Loading in other browsers or MV2, and opening settings through the browser's own menus, require separate checks.
