import {rspack} from "@rspack/core";
import type {Configuration as RspackConfig} from "@rspack/core";

import {build, serve, watch} from "./command";

import configResolver from "@cli/resolvers/config";
import bundlerResolver from "@cli/resolvers/bundler";
import topologyResolver from "@cli/resolvers/topology";
import {processPluginHandler} from "@cli/resolvers/plugin";

import {OptionalConfig, ReadonlyConfig} from "@typing/config";
import {TopologySnapshot} from "@typing/topology";
import {Command} from "@typing/app";

const startup = async (config: ReadonlyConfig): Promise<void> => {
    await Array.fromAsync(processPluginHandler(config.plugins, "startup", {config}));
};

export default async (config: OptionalConfig): Promise<void> => {
    // A full pipeline run WITHOUT creating the compiler: resolve config → startup → assemble
    // Rspack config → topology snapshot. The `dev` command runs this on every file event to
    // probe the build's shape cheaply, and only instantiates `rspack(rspackConfig)` when the
    // snapshot changed (HMR can't add/remove entries on a live build, so a change = restart).
    const discoverBuild = async (): Promise<{
        rspackConfig: RspackConfig;
        resolverConfig: ReadonlyConfig;
        snapshot: TopologySnapshot;
    }> => {
        const resolverConfig = await configResolver(config);

        await startup(resolverConfig);

        const rspackConfig = await bundlerResolver(resolverConfig);

        // Snapshot AFTER bundler so the entrypoint discovery cached during the `bundler` hook is
        // populated — the `topology` hook only reads it (no extra filesystem scan).
        const snapshot = await topologyResolver(resolverConfig);

        return {rspackConfig, resolverConfig, snapshot};
    };

    const {rspackConfig, resolverConfig, snapshot} = await discoverBuild();

    switch (resolverConfig.command) {
        case Command.Build:
            build(rspack(rspackConfig));
            break;

        case Command.Watch:
            watch(rspack(rspackConfig));
            break;

        case Command.Dev:
            await serve({compiler: rspack(rspackConfig), snapshot}, resolverConfig, discoverBuild);
            break;

        default:
            console.error("Unknown command");
            process.exit(1);
    }
};
