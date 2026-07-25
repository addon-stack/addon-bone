import {createRequire} from "node:module";
import fs from "node:fs";
import path from "node:path";

import {Configuration as RspackConfig, RspackPluginInstance} from "@rspack/core";
import {RsdoctorRspackPlugin} from "@rsdoctor/rspack-plugin";
import {merge as mergeConfig} from "webpack-merge";

import manifestFactory from "../builders/manifest";
import {processPluginHandler} from "./plugin";

import ManifestPlugin from "@cli/bundler/plugins/ManifestPlugin";
import WatchPlugin from "@cli/bundler/plugins/WatchPlugin";
import {getResolvePath} from "@cli/resolvers/path";

import {ReadonlyConfig} from "@typing/config";
import {Command, PackageName, isWatchCommand} from "@typing/app";

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The framework's own compiled-output directory (`<adnbn>/dist`) as a REAL on-disk path. In local
 * framework development `adnbn` is symlinked into the project, so its output resolves to a path
 * OUTSIDE node_modules; rspack (`resolve.symlinks`) then watches it as a dependency and would
 * re-trigger the extension build every time the framework is rebuilt. Returns undefined when it
 * can't be resolved (then only node_modules is ignored).
 */
const resolveFrameworkOutput = (config: ReadonlyConfig): string | undefined => {
    try {
        const projectRequire = createRequire(path.join(getResolvePath(config.rootDir), "package.json"));

        return path.dirname(fs.realpathSync(projectRequire.resolve(PackageName)));
    } catch {
        return undefined;
    }
};

/**
 * Paths the dev/watch compiler must NOT watch: node_modules (also avoids EMFILE on large trees)
 * and — only for local framework development — the framework's own output dir, so rebuilding
 * `adnbn` does not spuriously re-trigger the extension's incremental build. For a published install
 * the output lives under node_modules and is already covered, so the extra term is a no-op there.
 */
const watchIgnore = (config: ReadonlyConfig): RegExp => {
    const frameworkOutput = resolveFrameworkOutput(config);

    if (!frameworkOutput) {
        return /[\\/]node_modules[\\/]/;
    }

    return new RegExp(`[\\\\/]node_modules[\\\\/]|^${escapeRegExp(frameworkOutput)}[\\\\/]`);
};

const getConfigFromPlugins = async (rspack: RspackConfig, config: ReadonlyConfig): Promise<RspackConfig> => {
    let mergedConfig: RspackConfig = {};

    for await (const {result: pluginConfig} of processPluginHandler(config.plugins, "bundler", () => ({
        rspack: mergeConfig(rspack, mergedConfig),
        config,
    }))) {
        mergedConfig = mergeConfig(mergedConfig, pluginConfig);
    }

    return mergedConfig;
};

const getConfigForManifest = async (config: ReadonlyConfig): Promise<RspackConfig> => {
    let manifest = manifestFactory(config);

    // Recreate the manifest on every (re)build: the manifest hooks APPEND (permissions, csp,
    // content scripts…), so re-running them on a reused instance accumulates stale values across
    // watch/dev rebuilds. ManifestPlugin reads the current instance lazily via the getter below.
    const update = async () => {
        manifest = manifestFactory(config);

        await Array.fromAsync(processPluginHandler(config.plugins, "manifest", {manifest, config}));
    };

    await update();

    const plugins: RspackPluginInstance[] = [];

    if (isWatchCommand(config.command)) {
        plugins.push(
            new WatchPlugin(async () => {
                await update();
            })
        );
    }

    plugins.push(new ManifestPlugin(() => manifest));

    return {plugins};
};

export default async (config: ReadonlyConfig): Promise<RspackConfig> => {
    let rspack: RspackConfig = {
        entry: {},
        mode: config.mode,
        cache: false,
    };

    // prettier-ignore
    rspack = mergeConfig(
        rspack,
        await getConfigFromPlugins(rspack, config),
        await getConfigForManifest(config)
    );

    if (config.debug) {
        rspack = mergeConfig(rspack, {
            stats: {
                errorDetails: true,
            },
        });
    }

    if (isWatchCommand(config.command)) {
        rspack = mergeConfig(rspack, {
            devtool: config.command === Command.Dev ? "cheap-module-source-map" : "inline-source-map",
            // The dev server drives the watch via compiler.options.watchOptions, so the ignore list
            // must live in the config (otherwise the dev server tries to watch the whole tree and
            // dies with EMFILE on large projects). See watchIgnore for what's excluded and why.
            watchOptions: {
                ignored: watchIgnore(config),
            },
        });
    }

    if (config.command === Command.Build) {
        if (config.analyze) {
            rspack = mergeConfig(rspack, {
                plugins: [
                    new RsdoctorRspackPlugin({
                        supports: {
                            banner: true,
                            parseBundle: true,
                            generateTileGraph: true,
                        },
                    }),
                ],
            });
        }
    }

    return rspack;
};
