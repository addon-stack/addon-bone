# Entrypoint asset maps

`BuildAssetsMapPlugin` collects the complete entrypoint inventory for manifest generation on every
compilation. Runtime delivery is selected separately through the configured module's used exports.
The output feature composes it with `GenerateModulePlugin`, which provides `#adnbn/entrypoint`.

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
