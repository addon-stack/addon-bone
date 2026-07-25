import path from "path";
import type {Compilation, Compiler} from "@rspack/core";

import VirtualModuleAdapter from "./VirtualModuleAdapter";

import {getResolvePath} from "@cli/resolvers/path";

import {PackageName} from "@typing/app";

export type VirtualData = Record<string, unknown>;

export interface VirtualDataWatch {
    /** Recompute the module's data on a relevant source change (re-read from disk). */
    update: () => VirtualData | Promise<VirtualData>;

    /** Source files whose change should rewrite the module (absolute paths). */
    files?: string[];

    /** Source directories to watch (absolute paths) — covers added/removed files in them. */
    dirs?: string[];
}

/**
 * Publishes a "data slot" as a virtual module that EXPORTS data (`export const k = <json>`),
 * importable by a stable specifier `adnbn/virtual/<slot>`. Unlike a `DefinePlugin` global, the
 * content can be rewritten live on `watchRun`, so a data edit rides the incremental recompile
 * instead of forcing a dev-server restart (the value is no longer part of the topology snapshot).
 *
 * How `adnbn/virtual/<slot>` resolves:
 * - inside an adnbn extension build → {@link alias} overrides it to the live written module;
 * - outside (published package, no alias) → `package.json#exports` → a stub with safe defaults;
 * - framework source typecheck → an ambient `declare module` (src/cli/virtual/virtual.d.ts).
 *
 * It ALSO registers the data sources in Rspack's watch graph (`compilation.fileDependencies` /
 * `contextDependencies`): locale YAML and the like are NOT module imports, so without this Rspack
 * never sees the change and `watchRun` would not fire — the module would silently go stale once
 * the value is removed from the topology snapshot.
 */
export default class VirtualDataPlugin {
    private readonly pluginName = "VirtualDataPlugin";
    private readonly adapter: VirtualModuleAdapter;
    private watching?: VirtualDataWatch;

    /** Last content written to the virtual module — used to skip no-op rewrites (see apply). */
    private content: string;

    /** Last update error — surfaced to `compilation.errors` so a bad dev edit doesn't crash. */
    private error?: Error;

    constructor(
        private readonly slot: string,
        initial: VirtualData
    ) {
        this.content = VirtualDataPlugin.render(initial);
        this.adapter = new VirtualModuleAdapter({[VirtualDataPlugin.storageName(slot)]: this.content});
    }

    /** Stable import specifier consumers use, e.g. `adnbn/virtual/locale`. */
    public static specifier(slot: string): string {
        return `${PackageName}/virtual/${slot}`;
    }

    /** VirtualModulesPlugin storage key — a path relative to `compiler.context`. */
    public static storageName(slot: string): string {
        return path.join("virtual", "data", `${slot}.ts`);
    }

    /** ESM data-module body: one `export const` per key, baked exactly like the old define. */
    public static render(data: VirtualData): string {
        return (
            Object.entries(data)
                .map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`)
                .join("\n") + "\n"
        );
    }

    /**
     * `resolve.alias` fragment that points the specifier at the live virtual module. The target is
     * the absolute path where VirtualModulesPlugin stores it (rooted at `compiler.context` = cwd,
     * same root as {@link getResolvePath}); rspack `alias` outranks package `exports`. Merge this
     * into the owning plugin's returned rspack config.
     */
    public alias(): Record<string, string> {
        return {[VirtualDataPlugin.specifier(this.slot)]: getResolvePath(VirtualDataPlugin.storageName(this.slot))};
    }

    public watch(watching: VirtualDataWatch): this {
        this.watching = watching;

        return this;
    }

    public apply(compiler: Compiler): void {
        this.adapter.apply(compiler);

        const watching = this.watching;

        if (!watching) {
            return;
        }

        const files = new Set(watching.files ?? []);
        const dirs = watching.dirs ?? [];

        // Make Rspack watch the data sources (they are not module imports). Without this the
        // compiler never re-runs on a pure data edit and `watchRun` below never fires.
        compiler.hooks.afterCompile.tap(this.pluginName, (compilation: Compilation) => {
            for (const file of files) {
                compilation.fileDependencies.add(file);
            }

            for (const dir of dirs) {
                compilation.contextDependencies.add(dir);
            }
        });

        compiler.hooks.compilation.tap(this.pluginName, (compilation: Compilation) => {
            if (this.error) {
                compilation.errors.push(this.error);
            }
        });

        // With file/dir sources (asset-based data like locale/icon — NOT in the module graph),
        // re-derive only when those sources actually change. Without sources, the data derives from
        // the module graph (entry files Rspack already watches), so re-derive on every recompile.
        const conditional = files.size > 0 || dirs.length > 0;

        compiler.hooks.watchRun.tapPromise(this.pluginName, async current => {
            if (conditional) {
                // Consider removals too — deleting a source file must rewrite the module as well.
                const changed = new Set<string>([...(current.modifiedFiles ?? []), ...(current.removedFiles ?? [])]);

                if (!this.touched(changed, current.context ?? process.cwd(), files, dirs)) {
                    return;
                }
            }

            try {
                const content = VirtualDataPlugin.render(await watching.update());

                this.error = undefined;

                // Skip the write (and the recompile it would trigger) when the data is unchanged —
                // essential for the unconditional path, else writeModule re-dirties the module every
                // watchRun and spins an infinite recompile loop.
                if (content === this.content) {
                    return;
                }

                this.content = content;

                this.adapter.writeModule(VirtualDataPlugin.storageName(this.slot), content);
            } catch (e) {
                // Keep last-known-good content and surface the error as a compilation error rather
                // than crashing the dev server on a bad source edit.
                this.error = e instanceof Error ? e : new Error(String(e));
            }
        });
    }

    private touched(changed: Set<string>, context: string, files: Set<string>, dirs: string[]): boolean {
        for (const raw of changed) {
            const file = path.isAbsolute(raw) ? raw : path.resolve(context, raw);

            if (files.has(file) || files.has(raw)) {
                return true;
            }

            for (const dir of dirs) {
                if (file === dir || file.startsWith(dir + path.sep)) {
                    return true;
                }
            }
        }

        return false;
    }
}
