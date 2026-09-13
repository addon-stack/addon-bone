# Generated modules

`GenerateModulePlugin` maps import specifiers to JavaScript source through Rspack's native virtual
file store. Files have stable paths under the compiler context's `node_modules/.adnbn-virtual` and
exist only in that compiler's memory. Identical builds therefore retain stable module identities;
concurrent compilers can use the same paths without sharing source updates or deleting each other's
files.

`watch()` prepares changed sources before compilation. The first update is applied when the native
virtual store becomes available. Later updates are applied before cache invalidation and included in
the compiler's modified files, so consumers receive new data in the same rebuild. Unchanged sources
are not rewritten. Declared file and directory dependencies are registered per compilation, and
update failures are reported as compilation errors so watch can recover on the next edit. `layer()`
keeps its issuer selection and module-layer behavior independently of the virtual file storage.
