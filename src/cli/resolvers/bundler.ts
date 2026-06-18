import {Configuration as RspackConfig, RspackPluginInstance} from "@rspack/core";
import {RsdoctorRspackPlugin} from "@rsdoctor/rspack-plugin";
import {merge as mergeConfig} from "webpack-merge";

import manifestFactory from "../builders/manifest";
import {processPluginHandler} from "./plugin";

import ManifestPlugin from "@cli/bundler/plugins/ManifestPlugin";
import WatchPlugin from "@cli/bundler/plugins/WatchPlugin";

import {ReadonlyConfig} from "@typing/config";
import {Command, isWatchCommand} from "@typing/app";

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
            // Don't watch node_modules. The legacy watch() passed this to compiler.watch()
            // directly; the dev server drives the watch via compiler.options.watchOptions,
            // so it must live in the config or the dev server tries to watch the whole tree
            // and dies with EMFILE on large projects.
            watchOptions: {
                ignored: /[\\/]node_modules[\\/]/,
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
