# Runtime data

`RuntimeDataPlugin` embeds a serializable snapshot known before filename hashing. It does not emit
a carrier file, fetch metadata or connect another entrypoint's JavaScript. `update(data)` changes
the next compilation's snapshot, including watch rebuilds.

The optional `test(entry)` selects entrypoints by name. Without it, every runtime receives the data.
With a shared runtime chunk, matching any consuming entrypoint selects that runtime. The selector
does not inspect API usage or tree-shake individual map entries. Excluding a runtime that reads the
property is the caller's error.

Insertion is guarded once per runtime and plugin instance within each compilation. Distinct properties
can coexist. Guard and snapshot state are refreshed per compilation, not retained across rebuilds.
