import type {DotenvParseOutput} from "dotenv";

import {
    pluginAction,
    pluginAsset,
    pluginBackground,
    pluginBundler,
    pluginContent,
    pluginDotenv,
    pluginHtml,
    pluginIcon,
    pluginLocale,
    pluginMeta,
    pluginOffscreen,
    pluginManifest,
    pluginOptimization,
    pluginOptions,
    pluginOutput,
    pluginOverride,
    pluginPage,
    pluginPopup,
    pluginPublic,
    pluginReact,
    pluginSandbox,
    pluginSidebar,
    pluginStyle,
    pluginTypescript,
    pluginVersion,
    pluginView,
} from "../plugins";

import type {Plugin} from "@typing/plugin";

export default (optionPlugins: Plugin[], userPlugins: Plugin[], vars: DotenvParseOutput): Plugin[] => {
    /**
     * IMPORTANT: the order of plugins matters. Early plugins prepare the environment and artifacts for the following ones
     * (e.g., environment variables/output/transpilation/assets → page/version generation → bundling).
     * Reordering may result in missing artifacts, incorrect configuration, or build failures.
     */
    const corePlugins: Plugin[] = [
        pluginDotenv(vars),
        pluginOutput(),
        pluginOptimization(),
        pluginTypescript(),
        pluginReact(),
        pluginIcon(),
        pluginAsset(),
        pluginStyle(),
        pluginLocale(),
        pluginMeta(),
        pluginAction(),
        pluginContent(),
        pluginBackground(),
        pluginOptions(),
        pluginOverride(),
        pluginPopup(),
        pluginPublic(),
        pluginSidebar(),
        pluginOffscreen(),
        pluginSandbox(),
        pluginPage(),
        pluginView(),
        pluginHtml(),
        pluginVersion(),
        pluginBundler(),
        pluginManifest(),
    ];

    return [...optionPlugins, ...userPlugins, ...corePlugins];
};
