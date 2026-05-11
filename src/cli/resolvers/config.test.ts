jest.mock("../plugins", () => {
    const plugin = (name: string) => () => ({name});

    return {
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
        pluginOutput: plugin("output"),
        pluginPage: plugin("page"),
        pluginPopup: plugin("popup"),
        pluginPublic: plugin("public"),
        pluginReact: plugin("react"),
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

import {Workspace} from "@typing/app";
import {Language} from "@typing/locale";

const mockedLoadConfig = jest.mocked(loadConfig);

describe("config resolver", () => {
    beforeEach(() => {
        mockedLoadConfig.mockResolvedValue({config: {}});
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
