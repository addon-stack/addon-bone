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

    test("tolerates an empty / comment-only locale file as a draft (no error)", async () => {
        const finder = makeFinder("empty-file");

        // The file is discovered (so the language is present) but contributes no real keys —
        // only the injected language marker. Crucially, it does NOT throw.
        await expect(finder.languages()).resolves.toEqual(new Set([Language.English]));
        await expect(finder.keys()).resolves.toEqual(new Set(["locale"]));
    });

    test("rejects a non-empty locale file whose root is not an object", async () => {
        await expect(makeFinder("non-object").keys()).rejects.toThrow("root must be an object");
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
});
