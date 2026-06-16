import {rspack} from "@rspack/core";

import {build, serve, watch} from "./command";

import configResolver from "@cli/resolvers/config";
import bundlerResolver from "@cli/resolvers/bundler";
import {processPluginHandler} from "@cli/resolvers/plugin";

import {OptionalConfig, ReadonlyConfig} from "@typing/config";
import {Command} from "@typing/app";

const startup = async (config: ReadonlyConfig): Promise<void> => {
    await Array.fromAsync(processPluginHandler(config.plugins, "startup", {config}));
};

export default async (config: OptionalConfig): Promise<void> => {
    const resolverConfig = await configResolver(config);

    await startup(resolverConfig);

    const rspackConfig = await bundlerResolver(resolverConfig);

    const compiler = rspack(rspackConfig);

    switch (resolverConfig.command) {
        case Command.Build:
            build(compiler);
            break;

        case Command.Watch:
            watch(compiler);
            break;

        case Command.Dev:
            await serve(compiler, resolverConfig.server);
            break;

        default:
            console.error("Unknown command");
            process.exit(1);
    }
};
