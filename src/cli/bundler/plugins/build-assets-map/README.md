# Entrypoint asset maps

`BuildAssetsMapPlugin` collects the complete entrypoint inventory for manifest generation on every
compilation. Runtime delivery is selected separately through the configured module's used exports.
The output feature composes it with `GenerateModulePlugin`, which provides `#adnbn/runtime`.

The virtual module exports readers, not snapshots. The current-entry reader is supplied in consuming
non-background runtimes; the full-map reader is supplied only in a consuming background runtime.
Public getters retain their errors in unsupported contexts. Usage is inspected for each runtime,
including its shared and async modules and every module layer, before the runtime code is added.
Unknown export usage is treated conservatively. Disabling tree shaking or passing an entire module
namespace to other code can retain more readers than an optimized named import.

Only selected runtimes receive the additional map hash dependencies and embedded-map validation.
The current map is generated through Rspack's filename resolution lifecycle; the full map is embedded
at the start of asset processing, after filenames are resolved. Final validation checks the embedded
maps against the emitted inventory. The full-map runtime must remain a self-contained chunk, and
consuming entries must retain their own runtimes. Selection is recreated for every compilation,
including watch rebuilds that add or remove consumers.

Isolated CSS delivery belongs to `IsolatedStylesPlugin` and does not require these public maps.
The build inventory remains complete for manifest dependencies even when no runtime requests a map.

The same facade exposes `readContentStyles` for isolated content rendering. Its usage does not
select either asset-map reader or embed an asset map. Extension code accesses runtime properties
through the generated module; the asset-map and isolated-style plugins retain ownership of their data.

The output feature owns the facade request, reader definitions and asset-map reader selection in
`cli/plugins/output/runtime.ts`. Shared plugin infrastructure generates the readers from those
definitions; it has no knowledge of content or entrypoint asset properties.

Asset collection and classification live in `bundler/utils/assets.ts`. The per-compilation result is
shared with manifest generation through `bundler/plugins/utils/compilation-assets.ts`. Filename
template handling is independent in `bundler/utils/app-filename.ts` and `chunk-filename.ts`.
