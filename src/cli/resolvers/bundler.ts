import {Configuration as RspackConfig, RspackPluginInstance} from "@rspack/core";
import {RsdoctorRspackPlugin} from "@rsdoctor/core";
import {merge as mergeConfig} from "webpack-merge";
import path from "node:path";

import manifestFactory from "../builders/manifest";

import {processPluginHandler} from "@cli/handlers";
import {resolveRootPath} from "@cli/workspace";

import ManifestPlugin from "@cli/bundler/plugins/manifest";
import WatchPlugin from "@cli/bundler/plugins/watch";

import {ReadonlyConfig} from "@typing/config";
import {Command, Mode} from "@typing/app";

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

    const update = async () => {
        // Each compilation describes current entries; removed WAR/CSP rules must not accumulate.
        const next = manifestFactory(config);
        await Array.fromAsync(processPluginHandler(config.plugins, "manifest", {manifest: next, config}));
        manifest = next;
    };

    await update();

    const plugins: RspackPluginInstance[] = [];

    if (config.command === Command.Watch) {
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
    const root = resolveRootPath(config);

    let rspack: RspackConfig = {
        context: root,
        entry: {},
        mode: config.mode,
        // Extension CSP disallows eval-based source maps.
        devtool: config.mode === Mode.Development ? "cheap-module-source-map" : false,
        cache: false,
        module: {
            parser: {
                javascript: {
                    exportsPresence: "error",
                },
            },
        },
        resolve: {
            // Preserve project-relative CSS URLs such as url(/images/icon.svg).
            roots: [root],
            // Virtual entry modules may live outside the application. Keep issuer-local
            // lookup first, then resolve the consumer's packages from its project root.
            modules: ["node_modules", path.join(root, "node_modules")],
        },
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
                            parseBundle: true,
                        },
                    }),
                ],
            });
        }
    }

    return rspack;
};
