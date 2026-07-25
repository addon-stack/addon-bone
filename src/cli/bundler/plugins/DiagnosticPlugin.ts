import type {Compilation, Compiler} from "@rspack/core";

/**
 * Surfaces a deferred, out-of-band error as a compilation error.
 *
 * Some plugin hooks run OUTSIDE a compilation — e.g. the `manifest` hook executes during config
 * assembly (and is re-run on every dev rebuild via WatchPlugin). When such a hook degrades a bad
 * dev edit to last-known-good instead of throwing (so the dev server survives), the error would
 * otherwise vanish. Recording it here makes it show up in the dev overlay / stats exactly like a
 * normal compilation error, while the build keeps emitting last-known-good output.
 *
 * The error is read through a getter so the owning hook can set/clear it on each rebuild.
 */
export default class DiagnosticPlugin {
    private readonly pluginName = "DiagnosticPlugin";

    constructor(private readonly error: () => Error | undefined) {}

    public apply(compiler: Compiler): void {
        compiler.hooks.compilation.tap(this.pluginName, (compilation: Compilation) => {
            const error = this.error();

            if (error) {
                compilation.errors.push(error);
            }
        });
    }
}
