import path from "path";
import _ from "lodash";

import {ReadonlyConfig} from "@typing/config";

export const getResolvePath = (to: string): string => {
    return path.resolve(process.cwd(), to);
};

export const resolveRootPath = (config: ReadonlyConfig): string => {
    return getResolvePath(config.rootDir);
};

export const fromRootPath = (config: ReadonlyConfig, to?: string): string => {
    return path.join(config.rootDir, to ?? "");
};

export const getSourcePath = (config: ReadonlyConfig, to?: string): string => {
    return fromRootPath(config, path.join(config.srcDir, to ?? ""));
};

export const getSharedPath = (config: ReadonlyConfig, to?: string): string => {
    return fromRootPath(config, path.join(config.srcDir, config.sharedDir, to ?? ""));
};

export const getAppPath = (config: ReadonlyConfig, to?: string): string => {
    return fromRootPath(config, path.join(config.srcDir, config.appsDir, config.app, to ?? ""));
};

export const getAppSourcePath = (config: ReadonlyConfig, to?: string): string => {
    return getAppPath(config, path.join(config.appSrcDir, to ?? ""));
};

export const getOutputPath = (config: ReadonlyConfig): string => {
    return fromRootPath(config, path.join(config.outDir, getArtifactName(config)));
};

export const getConfigFile = (config: ReadonlyConfig): string => {
    return fromRootPath(config, config.configFile);
};

export const getArtifactName = (config: ReadonlyConfig): string => {
    const app = _.kebabCase(config.app);

    const replacements: Record<string, string> = {
        "[app]": app,
        "[name]": app,
        "[mode]": config.mode,
        "[browser]": config.browser,
        "[mv]": "mv" + config.manifestVersion.toString(),
    };

    const name = _.reduce(replacements, (result, value, key) => result.replaceAll(key, value), config.artifactName);

    return _.kebabCase(name).replace(/\bmv-(\d+)/gi, "mv$1");
};
