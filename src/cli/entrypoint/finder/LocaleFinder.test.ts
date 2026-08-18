import path from "path";

import LocaleFinder from "./LocaleFinder";

import {ReadonlyConfig} from "@typing/config";
import {Command} from "@typing/app";
import {Browser} from "@typing/browser";
import {Language} from "@typing/locale";

const fixtures = path.resolve(__dirname, "tests", "fixtures", "locale");

class TestLocaleFinder extends LocaleFinder {
    public languageFromFilename(filename: string): Language {
        return this.getLanguageFromFilename(filename);
    }
}

const makeFinder = (fixture: string, config: Partial<ReadonlyConfig> = {}): TestLocaleFinder => {
    const root = path.join(fixtures, fixture);

    return new TestLocaleFinder({
        app: "app",
        appSrcDir: ".",
        appsDir: "apps",
        browser: Browser.Chrome,
        command: Command.Build,
        lang: Language.English,
        localeDir: "locales",
        mergeLocales: true,
        mode: "production",
        plugins: [
            {
                name: root,
                locale: true,
            },
        ],
        rootDir: root,
        sharedDir: "shared",
        srcDir: "src",
        ...config,
    } as ReadonlyConfig);
};

const makeLayeredFinder = (config: Partial<ReadonlyConfig> = {}): TestLocaleFinder => {
    const root = path.join(fixtures, "layers");
    const resolvedConfig = {
        app: "app",
        appSrcDir: "app-src",
        appsDir: "apps",
        browser: Browser.Chrome,
        command: Command.Build,
        lang: Language.English,
        localeDir: "locales",
        mergeLocales: true,
        mode: "production",
        plugins: [],
        rootDir: path.join(root, "project"),
        sharedDir: "shared",
        srcDir: "src",
        ...config,
    } as ReadonlyConfig;

    const finder = new TestLocaleFinder(resolvedConfig);

    resolvedConfig.plugins.push(
        {
            name: path.join(root, "plugin"),
            locale: true,
        },
        {
            name: path.join(root, "plugin-override"),
            locale: true,
        },
        {
            name: "adnbn:locale",
            locale: () => finder.files(),
        }
    );

    return finder;
};

describe("LocaleFinder", () => {
    test("reports locale finder configuration", () => {
        const finder = makeFinder("partial", {
            localeDir: "translations",
            mergeLocales: false,
        });

        expect(finder.getDirectory()).toBe("translations");
        expect(finder.canMerge()).toBe(false);
        expect(finder.getNames().has(Language.English)).toBe(true);
        expect(finder.isValidExtension("yaml")).toBe(true);
        expect(finder.isValidExtension("yml")).toBe(true);
        expect(finder.isValidExtension("json")).toBe(true);
        expect(finder.isValidExtension("txt")).toBe(false);
        expect(finder.isValidName("en")).toBe(true);
        expect(finder.isValidName("en.chrome")).toBe(true);
        expect(finder.isValidName("missing")).toBe(false);
    });

    test("falls back to the default locale directory", () => {
        expect(makeFinder("partial", {localeDir: undefined}).getDirectory()).toBe("locales");
    });

    test("memoizes the plugin finder", () => {
        const finder = makeFinder("partial");

        expect(finder.plugin()).toBe(finder.plugin());
    });

    test("resolves languages from plain and browser-specific locale filenames", () => {
        const finder = makeFinder("partial");

        expect(finder.languageFromFilename("en.yaml")).toBe(Language.English);
        expect(finder.languageFromFilename("fr.chrome.json")).toBe(Language.French);
        expect(() => finder.languageFromFilename("missing.yaml")).toThrow("Invalid locale filename: missing.yaml");
    });

    test("allows non-default locales to omit default locale keys", async () => {
        await expect(makeFinder("partial").structure()).resolves.toMatchObject({
            "app.greeting": {
                plural: false,
                substitutions: ["name"],
            },
        });
    });

    test("reads locale builders, languages, keys and default structure", async () => {
        const finder = makeFinder("partial");

        await expect(finder.languages()).resolves.toEqual(new Set([Language.English, Language.French]));
        await expect(finder.keys()).resolves.toEqual(new Set(["app.name", "app.greeting", "locale"]));
        await expect(finder.structure()).resolves.toMatchObject({
            "app.name": {
                plural: false,
                substitutions: [],
            },
            "app.greeting": {
                plural: false,
                substitutions: ["name"],
            },
        });
    });

    test("parses json locale files", async () => {
        await expect(makeFinder("json").keys()).resolves.toEqual(new Set(["app.name", "locale"]));
    });

    test("parses yml locale files", async () => {
        await expect(makeFinder("yml").keys()).resolves.toEqual(new Set(["app.name", "locale"]));
    });

    test("reports whether locale files are empty", async () => {
        await expect(makeFinder("empty").empty()).resolves.toBe(true);
        await expect(makeFinder("partial").empty()).resolves.toBe(false);
    });

    test("returns empty locale data when no locale files exist", async () => {
        const finder = makeFinder("empty");

        await expect(finder.languages()).resolves.toEqual(new Set());
        await expect(finder.keys()).resolves.toEqual(new Set());
        await expect(finder.structure()).resolves.toEqual({});
    });

    test("caches builders until clear is called", async () => {
        const finder = makeFinder("partial");

        const first = await finder.builders();

        expect(await finder.builders()).toBe(first);
        expect(await finder.clear().builders()).not.toBe(first);
    });

    test("reads languages, keys and structure without validating non-default locale structure", async () => {
        const finder = makeFinder("substitution-mismatch");

        await expect(finder.languages()).resolves.toEqual(new Set([Language.English, Language.French]));
        await expect(finder.keys()).resolves.toEqual(new Set(["app.greeting", "locale"]));
        await expect(finder.structure()).resolves.toMatchObject({
            "app.greeting": {
                plural: false,
                substitutions: ["name"],
            },
        });
    });

    test("surfaces structure validation errors from real locale files", async () => {
        await expect(makeFinder("substitution-mismatch").validate()).rejects.toThrow(
            'Locale "fr" key "app.greeting" substitutions [firstName] must match default locale "en" substitutions [name]'
        );
    });

    test("merges plugin, source, shared, app, app source and browser-specific locales from lowest to highest priority", async () => {
        const builders = await makeLayeredFinder().builders();
        const locale = builders.get(Language.English);

        expect(locale).toBeDefined();
        expect(Object.fromEntries(locale!.get())).toMatchObject({
            title: "App Source Chrome",
            pluginOnly: "Later Plugin",
            sourceOnly: "Source",
            sharedOnly: "Shared",
            appOnly: "App",
            appSourceOnly: "App Source",
            browserOnly: "Chrome",
            appSourceBrowserOnly: "Chrome",
        });
    });

    test("keeps plugin locales as a baseline when workspace locale merging is disabled", async () => {
        const builders = await makeLayeredFinder({mergeLocales: false}).builders();
        const locale = builders.get(Language.English);

        expect(locale).toBeDefined();
        expect(Object.fromEntries(locale!.get())).toMatchObject({
            title: "App Source Chrome",
            pluginOnly: "Later Plugin",
            appSourceOnly: "App Source",
            appSourceBrowserOnly: "Chrome",
        });
        expect(locale!.get().has("sourceOnly")).toBe(false);
        expect(locale!.get().has("sharedOnly")).toBe(false);
        expect(locale!.get().has("appOnly")).toBe(false);
        expect(locale!.get().has("browserOnly")).toBe(false);
    });

    test("continues to the next workspace layer when a higher-priority locale directory is empty", async () => {
        const builders = await makeLayeredFinder({
            appSrcDir: "empty-app-src",
            mergeLocales: false,
        }).builders();
        const locale = builders.get(Language.English);

        expect(locale).toBeDefined();
        expect(Object.fromEntries(locale!.get())).toMatchObject({
            title: "App Chrome",
            pluginOnly: "Later Plugin",
            appOnly: "App",
            browserOnly: "Chrome",
        });
        expect(locale!.get().has("sourceOnly")).toBe(false);
        expect(locale!.get().has("sharedOnly")).toBe(false);
        expect(locale!.get().has("appSourceOnly")).toBe(false);
        expect(locale!.get().has("appSourceBrowserOnly")).toBe(false);
    });

    test("deduplicates locale files discovered through overlapping workspace paths", async () => {
        const multiFiles = [...(await makeLayeredFinder().files())].map(({file}) => file);
        const singleFiles = [...(await makeLayeredFinder({sharedDir: "."}).files())].map(({file}) => file);

        expect(new Set(multiFiles).size).toBe(multiFiles.length);
        expect(new Set(singleFiles).size).toBe(singleFiles.length);
    });

    test("rejects ambiguous locale files in the same layer", async () => {
        const root = path.join(fixtures, "duplicate-layer");
        const config = {
            app: "app",
            appSrcDir: ".",
            appsDir: "apps",
            browser: Browser.Chrome,
            command: Command.Build,
            lang: Language.English,
            localeDir: "locales",
            mergeLocales: true,
            mode: "production",
            plugins: [],
            rootDir: root,
            sharedDir: "shared",
            srcDir: "src",
        } as ReadonlyConfig;
        const finder = new TestLocaleFinder(config);

        config.plugins.push({
            name: "adnbn:locale",
            locale: () => finder.files(),
        });

        await expect(finder.builders()).rejects.toThrow(
            `Locale "en" has multiple generic files in the app source layer: "${path.join(root, "src/apps/app/locales/en.json")}" and "${path.join(root, "src/apps/app/locales/en.yaml")}"`
        );
    });
});
