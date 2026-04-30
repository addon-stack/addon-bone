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

const mockedLoadConfig = jest.mocked(loadConfig);

describe("config resolver", () => {
    beforeEach(() => {
        mockedLoadConfig.mockResolvedValue({config: {}});
    });

    test("uses source directory as shared layer by default", async () => {
        const config = await resolveConfig({configFile: "package.json"});

        expect(config.shared).toBe(false);
        expect(config.sharedDir).toBe(".");
    });

    test("uses default shared directory when shared is true", async () => {
        const config = await resolveConfig({
            configFile: "package.json",
            shared: true,
        });

        expect(config.shared).toBe(true);
        expect(config.sharedDir).toBe("shared");
    });

    test("uses custom shared directory when shared is a string", async () => {
        const config = await resolveConfig({
            configFile: "package.json",
            shared: "common",
        });

        expect(config.shared).toBe("common");
        expect(config.sharedDir).toBe("common");
    });

    test("normalizes shared directory after loading user config", async () => {
        mockedLoadConfig.mockResolvedValue({
            config: {
                shared: true,
            },
        });

        const config = await resolveConfig({configFile: "package.json"});

        expect(config.shared).toBe(true);
        expect(config.sharedDir).toBe("shared");
    });
});
