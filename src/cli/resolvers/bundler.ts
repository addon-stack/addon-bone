import {Configuration as RspackConfig, RspackPluginInstance} from "@rspack/core";
import {RsdoctorRspackPlugin} from "@rsdoctor/rspack-plugin";
import {merge as mergeConfig} from "webpack-merge";

import manifestFactory from "../builders/manifest";
import {processPluginHandler} from "./plugin";

import ManifestPlugin from "@cli/bundler/plugins/manifest";
import WatchPlugin from "@cli/bundler/plugins/watch";

import {ReadonlyConfig} from "@typing/config";
import {Command} from "@typing/app";

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
    const manifest = manifestFactory(config);

    // prettier-ignore
    const update = () => Array.fromAsync(
        processPluginHandler(config.plugins, "manifest", {manifest, config})
    );

    await update();

    const plugins: RspackPluginInstance[] = [];

    if (config.command === Command.Watch) {
        plugins.push(
            new WatchPlugin(async () => {
                await update();
            })
        );
    }

    plugins.push(new ManifestPlugin(manifest));

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

    if (config.command === Command.Watch) {
        rspack = mergeConfig(rspack, {
            devtool: "inline-source-map",
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
