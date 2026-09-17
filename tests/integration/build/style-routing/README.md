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

JavaScript uses one layer per execution world, independently of UI isolation. The style plugin
classifies default CSS and `?unisolated` CSS without inspecting JavaScript issuer layers.
The content plugin selects isolated delivery per entry; other entries load both categories in
their document. The same default CSS file can belong to an ordinary content manifest and to WAR
for Shadow/iframe consumers at the same time.
Tests include nested SCSS with Sass dependencies, normal content/popup reuse, the same CSS in both
destinations with contenthash-only names, and canonical runtime asset maps. Checks cover both execution-world layers,
an unrelated custom layer, and disabled isolated delivery.

`delivery-spike.integration.test.ts` now runs the production style rules. It checks one JavaScript
module per world for user components, React, adnbn and a direct `@addon-core/browser` import, without
package exceptions. Emitted JavaScript runs against simulated DOM loading events to verify mixed
lazy CSS waits, independent entry runtimes, late roots and watch changes without new JS identities.
`content-chunks.integration.test.ts` checks sharing with `commonChunks` both enabled and disabled.

`selective-split.integration.test.ts` now exercises the production entry-selective split. It covers
ordinary initial CSS names and import order, legal mixed chunks, isolated manifest/WAR routing and
watch selection changes with a shared lazy chunk. Matching browser suites measure initial cascade
and the shared-lazy boundary in real documents and ShadowRoots. See [selective-split/README.md](selective-split/README.md).

```sh
node scripts/test-run.mjs --selectProjects build --runTestsByPath tests/integration/build/style-routing/routing-spike.integration.test.ts tests/integration/build/style-routing/style-routing.integration.test.ts --runInBand
```

Production lifecycle and browser coverage lives in `browser/content/isolation-shadow`, `isolation-iframe`,
and `relay-styles`. `build/isolation/isolation-watch.integration.test.ts` exercises actual CLI
watch transitions, including changing the stylesheet query and adding/removing CSS font imports.
