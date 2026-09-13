# Options browser fixtures

See the [integration guide](../../README.md) for editor preparation, dependency setup, and test isolation.

Run only the Options browser cases from the repository root:

```bash
npm run test -- tests/integration/browser/options/options.integration.test.ts --runInBand
```

- `vanilla/src/options/index.ts` uses DOM rendering and event handling with default `openInTab: true`.
- `react/src/options/index.tsx` uses React state, explicit `openInTab: true`, and custom `as` and `htmlDir` values.

Each Options entrypoint keeps its `styles.css` in the same directory. `background.ts` and the independent `help.page.ts` or `help.page.tsx` remain standalone files.

Both cases open Options from the real background service worker in Chrome MV3. They check the exact `options_ui` object, the absence of `options_page`, a View chunk shared with the Help page, CSS application, state changes, and runtime errors. Expected pages are `options.html` and `ui/preferences.options.html`.

The embedded Options manifest matrix lives separately in `tests/integration/build/options/embedded` and runs without Chrome through `npm run test:integration:build`. It does not verify embedded settings UI in a browser.
