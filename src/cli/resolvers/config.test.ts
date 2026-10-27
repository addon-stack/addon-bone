jest.mock("../plugins", () => {
    const plugin = (name: string) => () => ({name});

    return {
        pluginAction: plugin("action"),
        pluginAsset: plugin("asset"),
        pluginBackground: plugin("background"),
        pluginBundler: plugin("bundler"),
        pluginContent: plugin("content"),
        pluginDotenv: plugin("dotenv"),
        pluginHtml: plugin("html"),
        pluginIcon: plugin("icon"),
        pluginLocale: plugin("locale"),
        pluginManifest: plugin("manifest"),
        pluginMeta: plugin("meta"),
        pluginOffscreen: plugin("offscreen"),
        pluginOptimization: plugin("optimization"),
        pluginOptions: plugin("options"),
        pluginOutput: plugin("output"),
        pluginOverride: plugin("override"),
        pluginPage: plugin("page"),
        pluginPopup: plugin("popup"),
        pluginPublic: plugin("public"),
        pluginReact: plugin("react"),
        pluginSandbox: plugin("sandbox"),
        pluginSidebar: plugin("sidebar"),
        pluginStyle: plugin("style"),
        pluginTypescript: plugin("typescript"),
        pluginVersion: plugin("version"),
        pluginView: plugin("view"),
    };
});

jest.mock("c12", () => ({
    loadConfig: jest.fn(),
}));

import {loadConfig} from "c12";

import resolveConfig from "./config";

import {Command, Mode, Workspace} from "@typing/app";
import {Browser} from "@typing/browser";
import type {OptionalConfig, UserConfig} from "@typing/config";
import {Language} from "@typing/locale";

const mockedLoadConfig = jest.mocked(loadConfig);

const productionFilenames = {
    assetsFilename: "[contenthash:4][ext]",
    jsFilename: "[contenthash:5].js",
    cssFilename: "[contenthash:5].css",
    cssIdentName: "[app]-[hash:base64:5]",
};

const readableFilenames = {
    assetsFilename: "[name]-[contenthash:4][ext]",
    jsFilename: "[name].js",
    cssFilename: "[name].css",
    cssIdentName: "[local]-[hash:base64:5]",
};

interface DefaultsScenario {
    label: string;
    options: OptionalConfig;
    user: UserConfig;
    expected: OptionalConfig;
}

describe("config resolver", () => {
    beforeEach(() => {
        mockedLoadConfig.mockResolvedValue({config: {}});
    });

    test.each<DefaultsScenario>([
        {label: "app", options: {}, user: {app: "reader"}, expected: {name: "reader"}},
        {label: "empty app", options: {}, user: {app: ""}, expected: {name: ""}},
        {label: "Safari", options: {}, user: {browser: Browser.Safari}, expected: {manifestVersion: 2}},
        {
            label: "Chrome after Safari",
            options: {browser: Browser.Safari},
            user: {browser: Browser.Chrome},
            expected: {manifestVersion: 3},
        },
        {
            label: "development mode",
            options: {mode: Mode.Production},
            user: {mode: Mode.Development},
            expected: readableFilenames,
        },
        {
            label: "production mode",
            options: {},
            user: {mode: Mode.Production},
            expected: productionFilenames,
        },
        {
            label: "none mode",
            options: {mode: Mode.Production},
            user: {mode: Mode.None},
            expected: readableFilenames,
        },
        {
            label: "debug enabled",
            options: {mode: Mode.Production},
            user: {debug: true},
            expected: readableFilenames,
        },
        {
            label: "debug disabled",
            options: {mode: Mode.Production, debug: true},
            user: {debug: false},
            expected: productionFilenames,
        },
        {
            label: "watch with production mode",
            options: {command: Command.Watch},
            user: {mode: Mode.Production},
            expected: readableFilenames,
        },
    ])("recalculates automatic defaults for $label", async ({options, user, expected}) => {
        mockedLoadConfig.mockResolvedValue({config: user});

        const config = await resolveConfig({configFile: "package.json", ...options});

        expect(config).toMatchObject({...user, ...expected});
    });

    test.each<DefaultsScenario>([
        {label: "resolver defaults", options: {}, user: {}, expected: readableFilenames},
        {
            label: "production build",
            options: {mode: Mode.Production},
            user: {},
            expected: productionFilenames,
        },
        {
            label: "production watch",
            options: {command: Command.Watch, mode: Mode.Production},
            user: {},
            expected: readableFilenames,
        },
    ])("preserves $label without overrides", async ({options, expected}) => {
        const config = await resolveConfig({configFile: "package.json", ...options});

        expect(config).toMatchObject({name: "addon", manifestVersion: 3, ...expected});
    });

    test.each(["launch", "file"])("preserves explicit initial defaults from %s", async source => {
        const explicit: UserConfig = {name: "addon", manifestVersion: 3, ...productionFilenames};
        const overrides: UserConfig = {app: "reader", browser: Browser.Safari, mode: Mode.Development};

        mockedLoadConfig.mockResolvedValue({config: {...overrides, ...(source === "file" ? explicit : {})}});

        const config = await resolveConfig({
            configFile: "package.json",
            mode: Mode.Production,
            ...(source === "launch" ? explicit : {}),
        });

        expect(config).toMatchObject({...overrides, ...explicit});
    });

    test("keeps file settings above launch settings, including filename functions", async () => {
        const filename = jest.fn(() => "custom.js");
        const user: UserConfig = {
            app: "reader",
            name: "File name",
            manifestVersion: 2,
            jsFilename: filename,
            cssFilename: "custom.css",
            assetsFilename: "custom[ext]",
            cssIdentName: "custom-[local]",
        };

        mockedLoadConfig.mockResolvedValue({config: user});

        const config = await resolveConfig({
            configFile: "package.json",
            name: "Launch name",
            manifestVersion: 3,
            ...productionFilenames,
        });

        expect(config).toMatchObject(user);
        expect(config.jsFilename).toBe(filename);
        expect(filename).not.toHaveBeenCalled();
    });

    test("recalculates only omitted fields when explicit settings come from both sources", async () => {
        mockedLoadConfig.mockResolvedValue({
            config: {app: "reader", mode: Mode.Development, cssFilename: "custom.css"},
        });

        const config = await resolveConfig({
            configFile: "package.json",
            mode: Mode.Production,
            jsFilename: "custom.js",
        });

        expect(config).toMatchObject({
            ...readableFilenames,
            name: "reader",
            jsFilename: "custom.js",
            cssFilename: "custom.css",
        });
    });

    test("treats undefined launch settings as automatic defaults", async () => {
        mockedLoadConfig.mockResolvedValue({config: {app: "reader", browser: Browser.Safari, debug: true}});

        const config = await resolveConfig({
            configFile: "package.json",
            mode: Mode.Production,
            name: undefined,
            manifestVersion: undefined,
            assetsFilename: undefined,
            jsFilename: undefined,
            cssFilename: undefined,
            cssIdentName: undefined,
        });

        expect(config).toMatchObject({name: "reader", manifestVersion: 2, ...readableFilenames});
    });

    test("preserves own undefined fields returned by the loader", async () => {
        const user = {app: "reader", name: undefined, jsFilename: undefined, description: undefined};

        mockedLoadConfig.mockResolvedValue({config: user});

        const config = await resolveConfig({configFile: "package.json", description: "Launch description"});

        expect(config).toMatchObject(user);
    });

    test("selects known launch fields without mutating options or copying their values", async () => {
        const options = {
            configFile: "package.json",
            description: undefined,
            html: [],
            bundler: {},
            env: {},
            unknown: "ignored",
        };

        const original = {...options};
        const config = await resolveConfig(options);

        expect(options).toEqual(original);
        expect(config).not.toHaveProperty("unknown");
        expect(config).toHaveProperty("description", undefined);
        expect(config.html).toBe(options.html);
        expect(config.bundler).toBe(options.bundler);
        expect(config.env).toBe(options.env);
    });

    test("creates fresh mutable defaults for each resolution", async () => {
        const first = await resolveConfig({configFile: "package.json"});
        const second = await resolveConfig({configFile: "package.json"});

        expect(first.html).toEqual([]);
        expect(second.html).toEqual([]);
        expect(second.html).not.toBe(first.html);
        expect(second.bundler).not.toBe(first.bundler);
        expect(second.env).not.toBe(first.env);
        expect(second.plugins).not.toBe(first.plugins);
    });

    test.each(["launch", "file"])("preserves empty strings and false from %s", async source => {
        const explicit: UserConfig = {
            name: "",
            assetsFilename: "",
            jsFilename: "",
            cssFilename: "",
            cssIdentName: "",
            debug: false,
            mergeStyles: false,
        };

        mockedLoadConfig.mockResolvedValue({config: {app: "reader", ...(source === "file" ? explicit : {})}});

        const config = await resolveConfig({
            configFile: "package.json",
            mode: Mode.Production,
            ...(source === "launch" ? explicit : {}),
        });

        expect(config).toMatchObject(explicit);
    });

    test("uses single workspace by default", async () => {
        const config = await resolveConfig({configFile: "package.json"});

        expect(config.workspace).toBe(Workspace.Single);
        expect(config.sharedDir).toBe(".");
    });

    test("uses English as the default language", async () => {
        const config = await resolveConfig({configFile: "package.json"});

        expect(config.lang).toBe(Language.English);
    });

    test("does not enable an action by default", async () => {
        const config = await resolveConfig({configFile: "package.json"});

        expect(config.action).toBeUndefined();
    });

    test("preserves explicit action options from build config", async () => {
        const action = {icon: "active", title: "@action.title"};
        const config = await resolveConfig({configFile: "package.json", action});

        expect(config.action).toEqual(action);
    });

    test("preserves an explicit empty action from user config", async () => {
        mockedLoadConfig.mockResolvedValue({config: {action: {}}});

        const config = await resolveConfig({configFile: "package.json"});

        expect(config.action).toEqual({});
    });

    test("normalizes language from user config", async () => {
        mockedLoadConfig.mockResolvedValue({
            config: {
                lang: "fr",
            },
        });

        const config = await resolveConfig({configFile: "package.json"});

        expect(config.lang).toBe(Language.French);
    });

    test("throws a clear error for invalid language config", async () => {
        mockedLoadConfig.mockResolvedValue({
            config: {
                lang: "missing",
            },
        });

        await expect(resolveConfig({configFile: "package.json"})).rejects.toThrow(
            'Invalid language "missing" provided by config'
        );
    });

    test("uses default shared directory for multi workspace", async () => {
        const config = await resolveConfig({
            configFile: "package.json",
            workspace: "multi",
        });

        expect(config.workspace).toBe(Workspace.Multi);
        expect(config.sharedDir).toBe("shared");
    });

    test("accepts workspace enum value", async () => {
        const config = await resolveConfig({
            configFile: "package.json",
            workspace: Workspace.Multi,
        });

        expect(config.workspace).toBe(Workspace.Multi);
        expect(config.sharedDir).toBe("shared");
    });

    test("uses custom shared directory for multi workspace", async () => {
        const config = await resolveConfig({
            configFile: "package.json",
            workspace: "multi",
            sharedDir: "common",
        });

        expect(config.workspace).toBe(Workspace.Multi);
        expect(config.sharedDir).toBe("common");
    });

    test("ignores custom shared directory for single workspace", async () => {
        const config = await resolveConfig({
            configFile: "package.json",
            workspace: "single",
            sharedDir: "common",
        });

        expect(config.workspace).toBe(Workspace.Single);
        expect(config.sharedDir).toBe(".");
    });

    test("normalizes workspace after loading user config", async () => {
        mockedLoadConfig.mockResolvedValue({
            config: {
                workspace: "multi",
            },
        });

        const config = await resolveConfig({configFile: "package.json"});

        expect(config.workspace).toBe(Workspace.Multi);
        expect(config.sharedDir).toBe("shared");
    });

    test("throws a clear error for invalid workspace config", async () => {
        mockedLoadConfig.mockResolvedValue({
            config: {
                workspace: "missing",
            },
        });

        await expect(resolveConfig({configFile: "package.json"})).rejects.toThrow(
            'Invalid workspace "missing" provided by config'
        );
    });
});
