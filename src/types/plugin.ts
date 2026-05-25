import {ManifestBuilder} from "@typing/manifest";
import {Configuration as RspackConfig} from "@rspack/core";

import {ReadonlyConfig} from "@typing/config";
import {EntrypointFile} from "@typing/entrypoint";
import {Awaiter} from "@typing/helpers";

/**
 * The result of executing the `entrypoint` function in a plugin.
 *
 * Can be one of the following values:
 *
 * - `true` — the entrypoint is considered active, and the file path is automatically
 *   inferred based on the key name of the entrypoint. For example, if the key is `background`,
 *   the file named `background` will be used by default.
 *
 * - `string` — a path to a single **file**
 *
 * - `string[]` — an array of paths to **files**
 *
 * - `EntrypointFile` — an object describing a single entrypoint file.
 *
 * - `EntrypointFile[]` — an array of `EntrypointFile` objects.
 *
 * - `Set<EntrypointFile>` — a unique set of `EntrypointFile` objects.
 */
export type PluginEntrypointResult = true | string | string[] | EntrypointFile | EntrypointFile[] | Set<EntrypointFile>;

export interface PluginConfigOptions {
    config: ReadonlyConfig;
}

// Manifest
export interface PluginManifestOptions extends PluginConfigOptions {
    manifest: ManifestBuilder;
}

// Bundler
export interface PluginBundlerOptions extends PluginConfigOptions {
    rspack: RspackConfig;
}

/**
 * The result of executing the `locales` function in a plugin.
 *
 * Can be one of the following values:
 *
 * - `true` — the system will look for a directory named `locales` and treat all files inside
 *   it as localization files.
 *
 * - `string` — a path to a specific **directory**, and all files inside will be treated as localization files.
 *
 * - `string[]` — an array of paths to **files** will be treated as localization files.
 *
 * - `Set<string>` — a unique set of localization files.
 */
export type PluginLocaleResult = PluginEntrypointResult;

/**
 * The result of executing the `icons` function in a plugin.
 *
 * Can be one of the following values:
 *
 * - `true` — the system will look for a directory named `icons` and treat all files inside
 *   it as image files.
 *
 * - `string` — a path to a specific **directory**, and all files inside will be treated as image files.
 *
 * - `string[]` — an array of paths to **files** will be treated as image files.
 *
 * - `Set<string>` — a unique set of image files.
 */
export type PluginIconResult = PluginEntrypointResult;

interface PluginName {
    name: string;
}

export interface Plugin extends PluginName {
    background?: PluginHandler<PluginConfigOptions, PluginEntrypointResult>;
    bundler?: PluginHandler<PluginBundlerOptions, RspackConfig>;
    command?: PluginHandler<PluginConfigOptions, PluginEntrypointResult>;
    content?: PluginHandler<PluginConfigOptions, PluginEntrypointResult>;
    page?: PluginHandler<PluginConfigOptions, PluginEntrypointResult>;
    popup?: PluginHandler<PluginConfigOptions, PluginEntrypointResult>;
    relay?: PluginHandler<PluginConfigOptions, PluginEntrypointResult>;
    sandbox?: PluginHandler<PluginConfigOptions, PluginEntrypointResult>;
    service?: PluginHandler<PluginConfigOptions, PluginEntrypointResult>;
    sidebar?: PluginHandler<PluginConfigOptions, PluginEntrypointResult>;
    offscreen?: PluginHandler<PluginConfigOptions, PluginEntrypointResult>;
    locale?: PluginHandler<PluginConfigOptions, PluginLocaleResult>;
    icon?: PluginHandler<PluginConfigOptions, PluginIconResult>;
    manifest?: PluginHandlerCallback<PluginManifestOptions>;
    startup?: PluginHandlerCallback<PluginConfigOptions>;
}

export type PluginHandler<O, T = void> = T | PluginHandlerCallback<O, T>;

export type PluginHandlerCallback<O, T = void> = {(options: O): Awaiter<T>};

export type PluginHandlerKeys = keyof Omit<Plugin, "name">;

export type PluginEntrypointKeys = keyof Pick<
    Plugin,
    "background" | "command" | "content" | "page" | "popup" | "relay" | "sandbox" | "service" | "sidebar" | "offscreen"
>;

export type PluginAssetKeys = keyof Pick<Plugin, "icon" | "locale">;

export type PluginHandlerType<T extends Plugin[PluginHandlerKeys]> =
    T extends PluginHandlerCallback<infer O, infer R> ? {options: O; result: R} : never;

export type PluginHandlerOptions<K extends PluginHandlerKeys> = PluginHandlerType<Plugin[K]>["options"];

export type PluginHandlerResult<K extends PluginHandlerKeys> = NonNullable<PluginHandlerType<Plugin[K]>["result"]>;

export interface PluginNameHandlerResult<K extends PluginHandlerKeys> extends PluginName {
    result: PluginHandlerResult<K>;
}

export type PluginDefinition<T extends any[] = []> = (...args: T) => Plugin;
