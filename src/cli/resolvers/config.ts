import {existsSync} from "fs";
import {loadConfig} from "c12";
import _ from "lodash";

import resolveDotenv from "./dotenv";
import resolvePlugins from "./plugins";
import {getConfigFile} from "@cli/workspace/paths";

import type {Config, OptionalConfig, ReadonlyConfig, UserConfig} from "@typing/config";
import {Command, Mode, Workspace} from "@typing/app";
import {Browser} from "@typing/browser";
import {Language, LanguageCodes} from "@typing/locale";
import {DefaultIconGroupName} from "@typing/icon";

type ConfigDefaultSources = Pick<Config, "app" | "browser" | "mode" | "command" | "debug">;

type ConfigDependentDefaults = Pick<
    Config,
    "name" | "manifestVersion" | "assetsFilename" | "jsFilename" | "cssFilename" | "cssIdentName"
>;

type ConfigDependentDefaultKey = keyof ConfigDependentDefaults;

interface ConfigInitialState {
    config: Config;
    automaticDefaults: ConfigDependentDefaultKey[];
}

const resolveDefaults = ({app, browser, mode, command, debug}: ConfigDefaultSources): ConfigDependentDefaults => {
    const production = mode === Mode.Production && command === Command.Build && !debug;

    return {
        name: app,
        manifestVersion: browser === Browser.Safari ? 2 : 3,
        assetsFilename: production ? "[contenthash:4][ext]" : "[name]-[contenthash:4][ext]",
        jsFilename: production ? "[contenthash:5].js" : "[name].js",
        cssFilename: production ? "[contenthash:5].css" : "[name].css",
        cssIdentName: production ? "[app]-[hash:base64:5]" : "[local]-[hash:base64:5]",
    };
};

const resolveLanguage = (lang?: `${Language}` | Language): Language => {
    if (!lang) {
        return Language.English;
    }

    if (LanguageCodes.has(lang)) {
        return lang as Language;
    }

    throw new Error(`Invalid language "${lang}" provided by config`);
};

const resolveWorkspace = (workspace?: Workspace | `${Workspace}`): Workspace => {
    if (!workspace) {
        return Workspace.Single;
    }

    if (Object.values(Workspace).includes(workspace as Workspace)) {
        return workspace as Workspace;
    }

    throw new Error(`Invalid workspace "${workspace}" provided by config`);
};

const resolveSharedDir = (workspace: Workspace, sharedDir: string): string => {
    return workspace === Workspace.Multi ? sharedDir : ".";
};

const getUserConfig = async (config: ReadonlyConfig): Promise<UserConfig> => {
    const configFilePath = getConfigFile(config);

    if (existsSync(configFilePath)) {
        const {config: userConfig} = await loadConfig<UserConfig>({
            configFile: configFilePath,
            dotenv: false,
            context: config,
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

const createInitialConfig = (options: OptionalConfig): ConfigInitialState => {
    const {
        command = Command.Build,
        debug = false,
        browser = Browser.Chrome,
        app = "addon",
        mode = Mode.Development,
    } = options;

    const initialDefaults = resolveDefaults({app, browser, mode, command, debug});

    const defaults: Config = {
        command,
        debug,
        mode,
        browser,
        app,
        ...initialDefaults,
        description: undefined,
        shortName: undefined,
        version: "VERSION",
        minimumVersion: "MINIMUM_VERSION",
        author: undefined,
        homepage: "HOMEPAGE",
        lang: Language.English,
        icon: DefaultIconGroupName,
        action: undefined,
        incognito: undefined,
        specific: undefined,
        manifest: undefined,
        workspace: Workspace.Single,
        rootDir: ".",
        outDir: "dist",
        srcDir: "src",
        sharedDir: "shared",
        appsDir: "apps",
        appSrcDir: ".",
        jsDir: "js",
        cssDir: "css",
        assetsDir: "assets",
        publicDir: "public",
        htmlDir: ".",
        localeDir: "locales",
        iconSrcDir: "icons",
        iconOutDir: "icons",
        html: [],
        bundler: {},
        env: {},
        plugins: [],
        analyze: false,
        configFile: "adnbn.config.ts",
        mergeBackground: false,
        mergeCommands: false,
        mergeContentScripts: false,
        concatContentScripts: true,
        mergeStyles: true,
        mergeIcons: false,
        mergeLocales: true,
        mergePages: false,
        mergePopup: false,
        mergePublic: false,
        multiplePopup: false,
        mergeSidebar: false,
        multipleSidebar: false,
        mergeRelay: false,
        mergeService: false,
        mergeOffscreen: false,
        mergeSandbox: false,
        commonChunks: true,
        artifactName: "[name]-[browser]-[mv]",
    };

    // Launch options accept known fields and fall back only for undefined values.
    const config = _.defaults({}, _.pick(options, Object.keys(defaults)), defaults);

    const automaticDefaults = (Object.keys(initialDefaults) as ConfigDependentDefaultKey[]).filter(
        key => options[key] === undefined
    );

    return {
        config: {...config, lang: resolveLanguage(config.lang), workspace: resolveWorkspace(config.workspace)},
        automaticDefaults,
    };
};

const applyUserConfig = (
    initialConfig: Config,
    userConfig: UserConfig,
    automaticDefaults: ConfigDependentDefaultKey[]
): Config => {
    const {lang, workspace, ...overrides} = userConfig;

    let config: Config = {
        ...initialConfig,
        ...overrides,
        lang: resolveLanguage(lang ?? initialConfig.lang),
        workspace: resolveWorkspace(workspace ?? initialConfig.workspace),
    };

    const defaults = resolveDefaults(config);

    config = {
        ...config,
        ...Object.fromEntries(
            automaticDefaults.filter(key => !Object.hasOwn(overrides, key)).map(key => [key, defaults[key]])
        ),
    };

    config.sharedDir = resolveSharedDir(config.workspace, config.sharedDir);

    return validateConfig(config);
};

export default async function resolveConfig(options: OptionalConfig): Promise<Config> {
    const {config: initialConfig, automaticDefaults} = createInitialConfig(options);
    const optionPlugins = initialConfig.plugins;
    const initialVars = resolveDotenv(initialConfig);
    const {plugins: userPlugins = [], ...userConfig} = await getUserConfig(initialConfig);
    const config = applyUserConfig(initialConfig, userConfig, automaticDefaults);
    const vars = {...initialVars, ...resolveDotenv(config)};

    return {
        ...config,
        plugins: resolvePlugins(optionPlugins, userPlugins, vars),
    };
}
