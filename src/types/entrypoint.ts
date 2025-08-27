import {Mode} from "@typing/app";
import {Browser} from "@typing/browser";
import {ManifestVersion} from "@typing/manifest";

export const EntrypointFileExtensions: ReadonlySet<string> = new Set(["ts", "tsx", "js", "jsx", "vue", "svelte"]);

export enum EntrypointType {
    Background = "background",
    Command = "command",
    ContentScript = "content",
    Page = "page",
    Service = "service",
    Relay = "relay",
    Options = "options",
    Popup = "popup",
    Sidebar = "sidebar",
    Offscreen = "offscreen",
}

export interface EntrypointOptions {
    /**
     * List of target browsers to include this entrypoint in. Defaults to being included in all
     * builds. Cannot be used with `exclude`. You must choose one of the two options.
     *
     * @default undefined
     */
    includeBrowser?: `${Browser}`[] | Browser[];

    /**
     * List of target browsers to exclude this entrypoint from. Cannot be used with `include`. You
     * must choose one of the two options.
     *
     * @default undefined
     */
    excludeBrowser?: `${Browser}`[] | Browser[];

    /**
     * List of target apps to include this entrypoint in. Defaults to being included in all builds.
     * Cannot be used with `excludeApp`. You must choose one of the two options.
     *
     * @default undefined
     */
    excludeApp?: string[];

    /**
     * List of target apps to exclude this entrypoint from. Cannot be used with `includeApp`. You
     * must choose one of the two options.
     *
     * @default undefined
     */
    includeApp?: string[];

    /**
     * Build mode for filtering entry points. Entry point will be included only
     * if it matches the current build mode (Production or Development).
     *
     * @default undefined
     */
    mode?: Mode

    /**
     * Manifest version constraint for this entry point. Entry point will be included
     * only if it matches the target manifest version.
     *
     * @default undefined
     */
    manifestVersion?: ManifestVersion

    /**
     * Debug mode flag. If true, entry point will be included only when building
     * with DEBUG flag enabled.
     *
     * @default undefined
     */
    debug?: boolean;
}

export interface EntrypointFile {
    file: string;
    import: string;
    external?: string;
}

/**
 * Dictionary of entrypoint for the build configuration.
 *
 * @key {string} - The name of the entrypoint that will be used in the bundler configuration.
 * @value {EntrypointFile[]} - Array of files that will be included in this entrypoint.
 * These files will be compiled and bundled together as part of the specified entrypoint.
 */
export type EntrypointEntries = Map<string, Set<EntrypointFile>>;

export interface EntrypointParser<O extends EntrypointOptions> {
    options(file: EntrypointFile): O;

    contract(file: EntrypointFile): string | undefined;
}

export interface EntrypointFinder {
    files(): Promise<Set<EntrypointFile>>;

    empty(): Promise<boolean>;

    exists(): Promise<boolean>;

    clear(): this;

    holds(file: EntrypointFile): boolean;
}

export interface EntrypointOptionsFinder<O extends EntrypointOptions> extends EntrypointFinder {
    type(): EntrypointType;

    options(): Promise<Map<EntrypointFile, O>>;

    contracts(): Promise<Map<EntrypointFile, string | undefined>>;
}

export interface EntrypointNameGenerator {
    reserve(name: string): this;

    name(name: string): string;

    file(file: EntrypointFile): string;

    likely(name?: string): boolean;

    has(name: string): boolean;

    reset(): this;
}

export interface EntrypointBuilder {
    build(): Promise<void>;

    destroy(): Promise<void>;
}

export type EntrypointConstructorParameter<T> = T extends new (arg: infer P) => any ? P : never;
