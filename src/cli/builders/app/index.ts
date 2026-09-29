import path from "node:path";

import {rspack, type Compiler, type Stats} from "@rspack/core";

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

export type AppBuildConfig = Omit<OptionalConfig, "command">;

let buildActive = false;

const createCompiler = async (config: ReadonlyConfig): Promise<Compiler> => {
    await startup(config);

    const rspackConfig = await bundlerResolver(config);

    return rspack(rspackConfig);
};

/** Sequential one-shot builds only; user config and plugins temporarily share the host environment. */
export const buildApp = async (config: AppBuildConfig): Promise<Stats> => {
    if (buildActive) {
        throw new Error("An app build is already running in this process; await it before starting another");
    }

    const configFile = config.configFile ?? "adnbn.config.ts";

    if (![".ts", ".mts", ".cts"].includes(path.extname(configFile))) {
        throw new Error(
            "buildApp requires a TypeScript config (.ts, .mts or .cts); use the CLI for other config formats"
        );
    }

    const environment = process.env;
    const snapshot = {...environment};
    buildActive = true;

    try {
        const resolved = await configResolver({...config, command: Command.Build});

        if (resolved.command !== Command.Build) {
            throw new Error("buildApp only supports the build command");
        }

        return await build(await createCompiler(resolved));
    } finally {
        for (const key of Object.keys(environment)) {
            if (!Object.hasOwn(snapshot, key)) {
                delete environment[key];
            }
        }

        Object.assign(environment, snapshot);
        process.env = environment;
        buildActive = false;
    }
};

export default async (config: OptionalConfig): Promise<Stats | undefined> => {
    const resolverConfig = await configResolver(config);

    if (resolverConfig.command !== Command.Build && resolverConfig.command !== Command.Watch) {
        throw new Error("Unknown command");
    }

    const compiler = await createCompiler(resolverConfig);

    if (resolverConfig.command === Command.Build) {
        return await build(compiler);
    }

    watch(compiler);
};
