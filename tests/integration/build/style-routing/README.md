# CSS destination routing

`routing-spike.integration.test.ts` is the independent Rspack feasibility check. It partitions
document and isolated CSS before asset emission, replaces only the selected CSS runtime module,
and proves that a mixed `import()` waits for both destinations. It covers content/Relay sharing,
a popup consuming the same module, filename hashes/callbacks, and watch selection changes.

The spike found that a bundler layer alone is insufficient: CssExtract also deduplicates by
loader request. The isolated branch therefore needs its own css-loader `ident`. Neither check
rewrites emitted bundles or CSS files.

`style-routing.integration.test.ts` uses the production style, asset, optimization, asset-map,
and isolated-style plugins. It checks manifest/WAR routing, common chunks on/off, runtime-only
entry chunks, browser-specific CSS URLs, binary assets and inline exclusions. Small resource
files in `src/resources` are build fixtures, not usable fonts or media; real WOFF2 rendering is
checked by the browser fixtures.

The config resolver supplies the style plugin's `isolationIssuerLayer` condition from the
shared build-layer contract used by content/Relay entries. The style plugin does not identify
entrypoint types itself. Production routing checks cover both execution-world layers, an
unrelated custom issuer selector, and no selector (all CSS stays on the ordinary path).

```sh
npx jest --runTestsByPath tests/integration/build/style-routing/routing-spike.integration.test.ts tests/integration/build/style-routing/style-routing.integration.test.ts --runInBand
```

Production lifecycle and browser coverage lives in `browser/content/isolation-shadow`, `isolation-iframe`,
and `relay-styles`. `build/isolation/isolation-watch.integration.test.ts` exercises actual CLI
watch transitions, including changing the stylesheet query and adding/removing CSS font imports.
