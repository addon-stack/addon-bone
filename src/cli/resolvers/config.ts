import {existsSync} from "fs";
import dotenv, {type DotenvParseOutput} from "dotenv";
import {loadConfig} from "c12";
import _ from "lodash";

import {
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
    pluginOptimization,
    pluginOutput,
    pluginPage,
    pluginPopup,
    pluginPublic,
    pluginReact,
    pluginSidebar,
    pluginStyle,
    pluginTypescript,
    pluginVersion,
    pluginView,
} from "../plugins";

import {fromRootPath, getAppPath, getAppSourcePath, getConfigFile} from "../resolvers/path";

import {Config, OptionalConfig, ReadonlyConfig, UserConfig} from "@typing/config";
import {Command, Mode} from "@typing/app";
import {Browser} from "@typing/browser";
import {Plugin} from "@typing/plugin";
import {ManifestVersion} from "@typing/manifest";
import {Language} from "@typing/locale";
import {DefaultIconGroupName} from "@typing/icon";

const getUserConfig = async (config: ReadonlyConfig): Promise<UserConfig> => {
    const configFilePath = getConfigFile(config);

    if (existsSync(configFilePath)) {
        const {config: userConfig} = await loadConfig<UserConfig>({
            configFile: configFilePath,
            dotenv: true,
        });

        if (config.debug) {
            console.log("Loaded user config:", configFilePath);
        }

        return userConfig || {};
    } else if (config.debug) {
        console.warn("Config file not found:", configFilePath);
    }

    return {};
};

const validateConfig = (config: ReadonlyConfig): ReadonlyConfig => {
    const {
        outDir,
        srcDir,
        sharedDir,
        appsDir,
        appSrcDir,
        jsDir,
        cssDir,
        assetsDir,
        htmlDir,
        publicDir,
        localeDir,
        iconSrcDir,
        iconOutDir,
    } = config;

    if (
        [
            outDir,
            srcDir,
            sharedDir,
            appsDir,
            appSrcDir,
            jsDir,
            cssDir,
            assetsDir,
            htmlDir,
            publicDir,
            localeDir,
            iconSrcDir,
            iconOutDir,
        ]
            .filter(dir => _.isString(dir))
            .some(dir => dir.includes(".."))
    ) {
        throw new Error('Directory paths cannot contain relative paths ("..") for security reasons.');
    }

    if (appsDir === sharedDir) {
        throw new Error("Apps directory (appsDir) and shared directory (sharedDir) cannot be the same.");
    }

    if (srcDir === outDir) {
        throw new Error("Source directory (srcDir) and destination directory (outputDir) cannot be the same.");
    }

    if (srcDir === ".") {
        throw new Error('Source directory cannot be the root directory (".") for security reasons.');
    }

    if (publicDir === "." || [srcDir, outDir, appSrcDir].includes(publicDir)) {
        throw new Error(
            'Public directory cannot be the root directory (".") or intersect with other root directories for security reasons.'
        );
    }

    return config;
};

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

const loadDotenv = (config: ReadonlyConfig): DotenvParseOutput => {
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

export default async (config: OptionalConfig): Promise<Config> => {
    let {
        command = Command.Build,
        debug = false,
        configFile = "adnbn.config.ts",
        browser = Browser.Chrome,
        app = "myapp",
        name = app,
        description,
        shortName,
        version = "VERSION",
        minimumVersion = "MINIMUM_VERSION",
        author = undefined,
        homepage = "HOMEPAGE",
        icon = DefaultIconGroupName,
        lang = Language.English,
        incognito,
        specific,
        rootDir = ".",
        outDir = "dist",
        srcDir = "src",
        sharedDir = "shared",
        appsDir = "apps",
        appSrcDir = ".",
        localeDir = "locales",
        iconSrcDir = "icons",
        iconOutDir = "icons",
        jsDir = "js",
        cssDir = "css",
        assetsDir = "assets",
        publicDir = "public",
        htmlDir = ".",
        html = [],
        bundler = {},
        env = {},
        manifestVersion = (new Set<Browser>([Browser.Safari]).has(browser) ? 2 : 3) as ManifestVersion,
        mode = Mode.Development,
        analyze = false,
        plugins = [],
        mergeBackground = false,
        mergeCommands = false,
        mergeContentScripts = false,
        concatContentScripts = true,
        mergeStyles = true,
        mergeIcons = false,
        mergeLocales = true,
        mergePages = false,
        mergePopup = false,
        mergePublic = false,
        multiplePopup = false,
        mergeSidebar = false,
        multipleSidebar = false,
        mergeRelay = false,
        mergeService = false,
        mergeOffscreen = false,
        commonChunks = true,
        artifactName = "[name]-[browser]-[mv]",
        assetsFilename = mode === Mode.Production && command === Command.Build && !debug
            ? "[contenthash:4][ext]"
            : "[name]-[contenthash:4][ext]",
        jsFilename = mode === Mode.Production && command === Command.Build && !debug
            ? "[contenthash:5].js"
            : "[name].js",
        cssFilename = mode === Mode.Production && command === Command.Build && !debug
            ? "[contenthash:5].css"
            : "[name].css",
        cssIdentName = mode === Mode.Production && command === Command.Build && !debug
            ? "[app]-[hash:base64:5]"
            : "[local]-[hash:base64:5]",
    } = config;

    let resolvedConfig: Config = {
        command,
        debug,
        mode,
        browser,
        app,
        name,
        description,
        shortName,
        version,
        minimumVersion,
        author,
        homepage,
        lang,
        icon,
        incognito,
        specific,
        manifestVersion,
        rootDir,
        outDir,
        srcDir,
        sharedDir,
        appsDir,
        appSrcDir,
        jsDir,
        cssDir,
        assetsDir,
        publicDir,
        htmlDir,
        localeDir,
        iconSrcDir,
        iconOutDir,
        html,
        bundler,
        env,
        plugins,
        analyze,
        configFile,
        mergeBackground,
        mergeCommands,
        mergeContentScripts,
        concatContentScripts,
        mergeStyles,
        mergeIcons,
        mergeLocales,
        mergePages,
        mergePopup,
        mergePublic,
        multiplePopup,
        mergeSidebar,
        multipleSidebar,
        mergeRelay,
        mergeService,
        mergeOffscreen,
        commonChunks,
        artifactName,
        assetsFilename,
        jsFilename,
        cssFilename,
        cssIdentName,
    };

    let vars = loadDotenv(resolvedConfig);

    const {plugins: userPlugins = [], ...userConfig} = await getUserConfig(resolvedConfig);

    resolvedConfig = validateConfig({...resolvedConfig, ...userConfig});

    vars = {...vars, ...loadDotenv(resolvedConfig)};

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
        pluginContent(),
        pluginBackground(),
        pluginPopup(),
        pluginPublic(),
        pluginSidebar(),
        pluginOffscreen(),
        pluginPage(),
        pluginView(),
        pluginHtml(),
        pluginVersion(),
        pluginBundler(),
    ];

    return {
        ...resolvedConfig,
        plugins: [...plugins, ...userPlugins, ...corePlugins],
    };
};
