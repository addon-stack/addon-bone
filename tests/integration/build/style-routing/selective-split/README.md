# Selective CSS split feasibility check

The initial feasibility probe is now a regression fixture for production style rules,
`ChunkLoaderPlugin`, `IsolatedStylesPlugin`, asset maps and manifest generation. The isolated
styles plugin owns the entry-selective `adnbnDocumentStyles` group; the style plugin only
classifies CSS and supplies loaders. No emitted source is patched.

Both consumers use one JavaScript world layer and the same dynamic-import call sites. Each
lazy module remains one physical JS chunk shared by normal and shadow consumers. Separate
modules cover document-first and document-last imports without a forced chunk name.

The build suite also covers ordinary initial popup/options/page/content/Relay entries beside
shadow entries, both import orders, named UI CSS, manifest/WAR and a repeated none/shadow/none
watch cycle. The actual CLI watch suite exercises the shared-lazy transition from entrypoint
options. Separate isolated-styles and asset-map tests cover differing initial/async filename
templates, hash placeholders and callbacks.

## Observed boundary

With Rspack 1.7.11, splitting the shared lazy chunk inserts its document CSS chunk before
its original UI CSS chunk. Both source import orders therefore produce:

- In the ordinary document: `?unisolated` CSS first, UI CSS second. The equal-specificity
  UI rule wins (blue), including when document CSS was imported last in the source.
- In ShadowRoot: only UI CSS. The document-only border does not leak into the root.
- The same result whether normal or shadow requests the shared module first. The import
  continuation observes applied CSS, and the second consumer does not duplicate document links.

This is a constraint of sharing the physical chunk, not a general query-priority contract.
When neither entry selects isolated delivery, the control build emits one lazy CSS file
with both categories in their source import order for this fixture.

Browser measurements passed on Chrome 156.0.8061.0 MV3 and Firefox 156.0 MV2/MV3. Each browser
test checks both import orders and both first-consumer orders (four cases per target).
Reports including computed styles and link order are written to
`.cache/integration/selective-split-<browser>-mv<version>.json`.

## Reproduce

```sh
node scripts/test-run.mjs --selectProjects build chrome firefox --testPathPatterns=selective-split --runInBand
```

Browser checks also measure the initial ordinary content cascade in both source orders: blue
for document-first and red for document-last. This asserts the fixture's normal bundler ordering,
not a general guarantee that CSS always follows JavaScript source order across arbitrary graphs.

This bounded fixture does not test iframe recovery, React rendering, CSP/fonts or performance.
Those runtime behaviors remain covered by the separate isolation suites; this is not a benchmark.
