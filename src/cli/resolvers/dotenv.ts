import dotenv, {type DotenvParseOutput} from "dotenv";

import {fromRootPath, getAppPath, getAppSourcePath} from "@cli/workspace";
import type {ReadonlyConfig} from "@typing/config";

const updateLocalDotenv = (config: ReadonlyConfig): DotenvParseOutput => {
    const {mode, app, browser, manifestVersion} = config;

    const localVars: DotenvParseOutput = {
        APP: app,
        BROWSER: browser,
        MODE: mode,
        MANIFEST_VERSION: String(manifestVersion),
    };

    Object.assign(process.env, localVars);

    return localVars;
};

export default (config: ReadonlyConfig): DotenvParseOutput => {
    const {mode, browser, debug} = config;

    const preset = [
        `.env.${mode}.${browser}.local`,
        `.env.${mode}.${browser}`,
        `.env.${browser}.local`,
        `.env.${browser}`,
        `.env.${mode}.local`,
        `.env.${mode}`,
        `.env.local`,
        `.env`,
    ];

    const appSourcePaths = preset.map(file => getAppSourcePath(config, file));
    const appPaths = preset.map(file => getAppPath(config, file));
    const rootPaths = preset.map(file => fromRootPath(config, file));

    const paths = [...appSourcePaths, ...appPaths, ...rootPaths];

    const {parsed: fileVars = {}} = dotenv.config({path: paths, quiet: !debug});

    return {...fileVars, ...updateLocalDotenv(config)};
};
