import path from "path";

import localePlugin from "./index";

import ManifestV3 from "@cli/builders/manifest/ManifestV3";

import {Command, Mode} from "@typing/app";
import {Browser} from "@typing/browser";
import {Language} from "@typing/locale";
import {ReadonlyConfig} from "@typing/config";

const fixtures = path.resolve(__dirname, "tests/fixtures");

const localeFixture = (name: string): Partial<ReadonlyConfig> => {
    const root = path.join(fixtures, name);

    return {
        rootDir: root,
        plugins: [
            {
                name: root,
                locale: true,
            },
        ],
    };
};

const makeConfig = (config: Partial<ReadonlyConfig> = {}): ReadonlyConfig =>
    ({
        app: "sample-app",
        appSrcDir: ".",
        appsDir: "apps",
        browser: Browser.Chrome,
        command: Command.Build,
        description: undefined,
        lang: Language.English,
        localeDir: "locales",
        manifestVersion: 3,
        mode: Mode.Production,
        name: undefined,
        plugins: [],
        rootDir: ".",
        sharedDir: "shared",
        shortName: undefined,
        srcDir: "src",
        ...config,
    }) as ReadonlyConfig;

const runManifest = async (config: Partial<ReadonlyConfig>): Promise<ManifestV3> => {
    const plugin = localePlugin();
    const resolvedConfig = makeConfig(config);
    const manifest = new ManifestV3(resolvedConfig.browser);

    await plugin.startup?.({config: resolvedConfig});
    await plugin.manifest?.({config: resolvedConfig, manifest});

    return manifest;
};

describe("locale plugin manifest", () => {
    test("uses plain name, short name and description when locale files are missing", async () => {
        const manifest = await runManifest({
            name: "Plain Name",
            shortName: "Plain Short",
            description: "Plain Description",
        });

        expect(manifest.build()).toMatchObject({
            name: "Plain Name",
            short_name: "Plain Short",
            description: "Plain Description",
        });
    });

    test("rejects locale keys when locale files are missing", async () => {
        await expect(
            runManifest({
                name: "@app.name",
            })
        ).rejects.toThrow('Locale name key "app.name" provided but no translations were found');
    });

    test("uses browser message references for locale keys when translations exist", async () => {
        const manifest = await runManifest({
            ...localeFixture("manifest"),
            name: "@app.name",
            shortName: "@app.short_name",
            description: "@app.description",
        });

        expect(manifest.build()).toMatchObject({
            name: "__MSG_app_name__",
            short_name: "__MSG_app_short_name__",
            description: "__MSG_app_description__",
            default_locale: Language.English,
        });
    });

    test("uses translated short name for Opera and Edge", async () => {
        const manifest = await runManifest({
            browser: Browser.Opera,
            ...localeFixture("manifest"),
            name: "@app.name",
            shortName: "@app.short_name",
        });

        expect(manifest.build()).toMatchObject({
            name: "__MSG_app_name__",
            short_name: "Short",
        });
    });

    test("rejects configured language that is not available in translations", async () => {
        await expect(
            runManifest({
                ...localeFixture("manifest"),
                lang: Language.German,
                name: "@app.name",
            })
        ).rejects.toThrow('Language "de" not found in available translations. Available languages: en, fr');
    });

    test("supports mixed plain and localized manifest fields", async () => {
        const manifest = await runManifest({
            ...localeFixture("manifest"),
            name: "Plain Name",
            description: "@app.description",
        });

        expect(manifest.build()).toMatchObject({
            name: "Plain Name",
            description: "__MSG_app_description__",
        });
    });
});
