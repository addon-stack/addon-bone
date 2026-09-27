import {rspack, type Stats} from "@rspack/core";

import {build} from "./build";
import {watch} from "./watch";

import configResolver from "@cli/resolvers/config";
import bundlerResolver from "@cli/resolvers/bundler";
import {processPluginHandler} from "@cli/resolvers/plugin";

import {OptionalConfig, ReadonlyConfig} from "@typing/config";
import {Command} from "@typing/app";

export {BuildError} from "./build";

const startup = async (config: ReadonlyConfig): Promise<void> => {
    await Array.fromAsync(processPluginHandler(config.plugins, "startup", {config}));
};

export default async (config: OptionalConfig): Promise<Stats | undefined> => {
    const resolverConfig = await configResolver(config);

    if (resolverConfig.command !== Command.Build && resolverConfig.command !== Command.Watch) {
        throw new Error("Unknown command");
    }

    await startup(resolverConfig);

    const rspackConfig = await bundlerResolver(resolverConfig);

    const compiler = rspack(rspackConfig);

    if (resolverConfig.command === Command.Build) {
        return await build(compiler);
    }

    watch(compiler);
};
