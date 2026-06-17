import {experiments, type Compiler} from "@rspack/core";

type RspackVirtualModulesPlugin = InstanceType<typeof experiments.VirtualModulesPlugin>;

/**
 * Thin adapter over Rspack 2's built-in `experiments.VirtualModulesPlugin`.
 *
 * It exists to hold one piece of Rspack-2 virtual-FS strangeness in a single place: the
 * plugin stores each module under a path RELATIVE to `compiler.context` (the "name", e.g.
 * `virtual/foo.tsx`, with no leading `./`), but an entry/import REQUEST that points at that
 * module must be a relative request (`./virtual/foo.tsx`) to resolve. A bare `virtual/foo.tsx`
 * request does NOT resolve (the deprecated third-party plugin made it work via a
 * `resolve.modules` + alias hack, which the built-in does not need and does not provide).
 *
 * Consumers ({@link EntrypointPlugin}, the offscreen plugin) write modules by name and ask
 * {@link entryRequest} for the request to push into `compiler.options.entry` — they never need
 * to know the name/request distinction.
 *
 * Caveats inherited from the built-in plugin:
 * - `writeModule` is only valid after the Rust compiler is initialized (never in
 *   `beforeCompile`/`compile`).
 * - There is no `removeModule` API; "removing" a module is `writeModule(name, "")`.
 */
export default class VirtualModuleAdapter {
    private readonly plugin: RspackVirtualModulesPlugin;

    constructor(modules: Record<string, string> = {}) {
        this.plugin = new experiments.VirtualModulesPlugin(modules);
    }

    public apply(compiler: Compiler): void {
        this.plugin.apply(compiler);
    }

    /**
     * Create or overwrite a virtual module. `name` is the storage key — a path relative to
     * `compiler.context` with no leading `./`.
     */
    public writeModule(name: string, content: string): void {
        this.plugin.writeModule(name, content);
    }

    /**
     * Normalize a storage `name` into the request used in `compiler.options.entry` and in
     * imports. Already-relative requests pass through unchanged.
     */
    public entryRequest(name: string): string {
        return /^\.{1,2}\//.test(name) ? name : `./${name}`;
    }
}
