# Override browser fixtures

See the [integration guide](../../README.md) for editor preparation, dependency setup, and test isolation.

Run only the override browser cases from the repository root:

```bash
npm run test -- tests/integration/browser/override/override.integration.test.ts --runInBand
```

- `newtab/src/newtab/index.tsx` uses React state with custom `as` and `htmlDir` values. The independent `help.page.tsx` shares the View chunk with it.
- `bookmarks/src/bookmarks/index.ts` and `history/src/history/index.ts` use DOM rendering and event handling with default output names.

Each entrypoint keeps its `styles.css` in the same directory. Chromium accepts a single overridden page per extension, so every page has its own application.

The cases navigate a real Chrome MV3 tab to `chrome://newtab`, `chrome://bookmarks`, and `chrome://history`. They check the exact `chrome_url_overrides` object, that the loaded document is the extension page, CSS application, state changes, and runtime errors. Expected pages are `ui/dashboard.newtab.html`, `bookmarks.html`, and `history.html`.

The browser support matrix and the competing-entrypoints failure live separately in `tests/integration/build/override` and run without Chrome through `npm run test:integration:build`.
