/**
 * Jest stub for the ESM-only, native-binding `@rspack/core`.
 *
 * Since Rspack 2.x, `@rspack/core` ships as ESM only and pulls the native
 * `@rspack/binding` at import time. Jest unit tests transform `.ts` as ESM via
 * `@swc/jest` but leave `node_modules` untransformed, so importing the real
 * package throws "Cannot use import statement outside a module".
 *
 * Unit tests here exercise plugin LOGIC (manifest building, entrypoint discovery,
 * locale validation on real fixtures) — never a real Rust build — so the bundler
 * classes are no-op stand-ins. End-to-end builds run the real CLI, not jest.
 *
 * Only runtime VALUES used by plugin code need to live here; type-only imports
 * (Configuration, Compiler, Compilation types, EntryNormalized, …) are erased.
 */

export class DefinePlugin {
    constructor(public readonly definitions: Record<string, unknown> = {}) {}
    apply(): void {}
}

export class HtmlRspackPlugin {
    constructor(public readonly options: unknown = {}) {}
    apply(): void {}
}

export class CopyRspackPlugin {
    constructor(public readonly options: unknown = {}) {}
    apply(): void {}
}

export class CssExtractRspackPlugin {
    static loader = "css-extract-rspack-loader-stub";
    constructor(public readonly options: unknown = {}) {}
    apply(): void {}
}

export class HotModuleReplacementPlugin {
    apply(): void {}
}

export class NormalModule {}

export const Compilation = {
    PROCESS_ASSETS_STAGE_ADDITIONAL: 2000,
    PROCESS_ASSETS_STAGE_OPTIMIZE: 100,
} as Record<string, number>;

class RawSource {
    constructor(private readonly value: string) {}
    source(): string {
        return this.value;
    }
}

class ReplaceSource {
    constructor(private readonly original: unknown) {}
    replace(): void {}
    source(): string {
        return "";
    }
}

export const sources = {RawSource, ReplaceSource, OriginalSource: RawSource};

class VirtualModulesPlugin {
    constructor(public readonly modules: Record<string, string> = {}) {}
    writeModule(): void {}
    apply(): void {}
}

export const experiments = {VirtualModulesPlugin};

export const rspack = Object.assign(() => ({}), {
    HotModuleReplacementPlugin,
    DefinePlugin,
    experiments,
});

export default rspack;
