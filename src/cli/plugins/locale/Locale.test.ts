import fs from "fs";
import os from "os";
import path from "path";

import Locale from "./Locale";
import {Command, Mode, Workspace} from "@typing/app";
import {Browser} from "@typing/browser";
import {ReadonlyConfig} from "@typing/config";
import {Language, LocaleMessages} from "@typing/locale";
import {GenerateJsonPluginData} from "@cli/bundler";
import {flattenLocaleMessages, getLocaleFilename} from "@shared/locale";

const fixtures = path.resolve(__dirname, "tests/fixtures/completion");

const makeLocale = (fixture: string, overrides: Partial<ReadonlyConfig> = {}): Locale => {
    const plugins = [...(overrides.plugins ?? [])];
    const config = {
        app: "alpha",
        appSrcDir: ".",
        appsDir: "apps",
        browser: Browser.Chrome,
        command: Command.Build,
        lang: Language.English,
        localeDir: "locales",
        mergeLocales: true,
        mode: Mode.Production,
        rootDir: path.join(fixtures, fixture),
        sharedDir: ".",
        srcDir: "src",
        workspace: Workspace.Single,
        ...overrides,
        plugins,
    } as ReadonlyConfig;
    const locale = new Locale(config);

    plugins.push({name: "adnbn:locale", locale: () => locale.files()});

    return locale;
};

const makeLayeredLocale = (config: Partial<ReadonlyConfig> = {}): Locale =>
    makeLocale("layered/project", {
        appSrcDir: "app-src",
        sharedDir: "shared",
        workspace: Workspace.Multi,
        plugins: [{name: path.join(fixtures, "layered/plugin"), locale: true}],
        ...config,
    });

const messages = (json: GenerateJsonPluginData, lang: Language): LocaleMessages =>
    json[getLocaleFilename(lang)] as LocaleMessages;

describe("locale JSON completion", () => {
    let consoleWarnSpy: jest.SpyInstance;
    const temporaryDirectories: string[] = [];

    beforeEach(() => {
        consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
        for (const root of temporaryDirectories.splice(0)) {
            fs.rmSync(root, {recursive: true, force: true});
        }
    });

    test("completes ordinary keys while keeping translations, empty strings and extra keys", async () => {
        const json = await makeLocale("single").json();

        expect(messages(json, Language.French)).toEqual({
            app_title: {message: "Titre français"},
            app_greeting: {message: "Hello {{ name }}"},
            empty: {message: ""},
            zero: {message: "0"},
            cart_items: {message: "{{count}} article|{{count}} articles"},
            extra: {message: "Seulement en français"},
            locale: {message: "fr"},
        });
        expect(messages(json, Language.English).locale).toEqual({message: "en"});
        expect(messages(json, Language.German).locale).toEqual({message: "de"});
        expect(Object.keys(json).sort()).toEqual([
            getLocaleFilename(Language.German),
            getLocaleFilename(Language.English),
            getLocaleFilename(Language.French),
        ]);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'Locale "fr" contains unknown key "extra" not found in default locale "en"'
        );
    });

    test("does not change source files, builders or the default-only contract", async () => {
        const locale = makeLocale("single");
        const builders = await locale.builders();
        const structure = await locale.structure();
        const sources = [...(await locale.files())].map(({file}) => [file, fs.readFileSync(file, "utf8")]);
        const english = [...builders.get(Language.English)!.get()];
        const french = [...builders.get(Language.French)!.get()];
        const first = await locale.json();

        expect(await locale.json()).toEqual(first);
        expect(await locale.builders()).toBe(builders);
        expect([...builders.get(Language.English)!.get()]).toEqual(english);
        expect([...builders.get(Language.French)!.get()]).toEqual(french);
        expect(builders.get(Language.French)!.get().has("app.greeting")).toBe(false);
        expect(await locale.structure()).toEqual(structure);
        expect((await locale.keys()).has("extra")).toBe(false);

        for (const [file, content] of sources) {
            expect(fs.readFileSync(file, "utf8")).toBe(content);
        }
    });

    test.each([
        [Browser.Chrome, "Alpha Chrome English", "Traduction alpha Chrome"],
        [Browser.Firefox, "Alpha app source English", "Traduction alpha app source"],
    ])("uses the fully layered default and target for %s", async (browser, fallbackTitle, translated) => {
        const french = messages(await makeLayeredLocale({browser}).json(), Language.French);

        expect(french).toMatchObject({
            fallbackTitle: {message: fallbackTitle},
            translated: {message: translated},
            pluginOnly: {message: "Plugin default"},
            sourceOnly: {message: "Source default"},
            sharedOnly: {message: "Shared default"},
            appOnly: {message: "Alpha app default"},
            appSourceOnly: {message: "Alpha app source default"},
            pluginItems: {message: "élément plugin|éléments plugin"},
            sharedItems: {message: "élément partagé|éléments partagés"},
            empty: {message: ""},
            locale: {message: "fr"},
        });
        expect(french.browserOnly).toEqual(browser === Browser.Chrome ? {message: "Alpha Chrome default"} : undefined);
    });

    test("isolates apps with different default languages over the same shared and plugin sources", async () => {
        const alpha = makeLayeredLocale();
        const beta = makeLayeredLocale({app: "beta", lang: Language.French});
        const [alphaJson, betaJson] = await Promise.all([alpha.json(), beta.json()]);

        expect(messages(alphaJson, Language.French).fallbackTitle).toEqual({message: "Alpha Chrome English"});
        expect(messages(betaJson, Language.English).betaOnly).toEqual({message: "Défaut beta app source"});
        expect(messages(betaJson, Language.English).appSourceOnly).toBeUndefined();
        expect(messages(alphaJson, Language.French).betaOnly).toBeUndefined();
        expect((await beta.structure()).betaOnly).toEqual({plural: false, substitutions: []});
    });

    test("completes selected files even when workspace layer merging is disabled", async () => {
        const french = messages(await makeLayeredLocale({mergeLocales: false}).json(), Language.French);

        expect(french.fallbackTitle).toEqual({message: "Alpha Chrome English"});
        expect(french.appSourceOnly).toEqual({message: "Alpha app source default"});
        expect(french.pluginOnly).toEqual({message: "Plugin default"});
        expect(french.sharedOnly).toBeUndefined();
        expect(french.sourceOnly).toBeUndefined();
        expect(french.appOnly).toBeUndefined();
    });

    test("validates missing plural keys even when json() is called directly", async () => {
        await expect(makeLocale("missing-plural").json()).rejects.toThrow(
            'Locale "fr" is missing plural key "cart.items" required by default locale "en"'
        );
    });

    test("rejects a missing configured default instead of guessing another language", async () => {
        await expect(makeLocale("single", {lang: Language.Italian}).json()).rejects.toThrow(
            'Default locale "it" not found in available translations'
        );
    });

    test("does not invent locale files when no translations exist", async () => {
        const locale = makeLocale("no-locales");

        expect(await locale.json()).toEqual({});
        expect(await locale.catalogue()).toEqual({});
        expect(await locale.languages()).toEqual(new Set());
    });

    test("leaves a default-only build unchanged without creating other languages", async () => {
        const locale = makeLayeredLocale({
            app: "beta",
            lang: Language.French,
            mergeLocales: false,
            plugins: [],
        });

        expect(await locale.json()).toEqual({
            [getLocaleFilename(Language.French)]: {
                betaOnly: {message: "Défaut beta app source"},
                locale: {message: "fr"},
            },
        });
    });

    test("reloads default completion after clearing the finder for a rebuild", async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-locale-rebuild-"));
        temporaryDirectories.push(root);
        fs.cpSync(path.join(fixtures, "single"), root, {recursive: true});
        const locale = makeLocale("single", {rootDir: root});

        expect(messages(await locale.json(), Language.French).app_greeting.message).toBe("Hello {{ name }}");

        fs.copyFileSync(path.join(fixtures, "updated/en.yaml"), path.join(root, "src/locales/en.yaml"));
        // The second representation must use the same prepared messages until explicitly cleared.
        expect((await locale.catalogue()).fr!.app_greeting).toBe("Hello {{ name }}");
        locale.clear();

        expect((await locale.catalogue()).fr!.app_greeting).toBe("Welcome {{ name }}");
        expect(messages(await locale.json(), Language.French).app_greeting.message).toBe("Welcome {{ name }}");
    });

    test.each([Browser.Chrome, Browser.Firefox])(
        "catalogue matches every completed JSON message for %s",
        async browser => {
            const locale = makeLayeredLocale({browser});
            const [json, catalogue] = await Promise.all([locale.json(), locale.catalogue()]);
            expect(Object.keys(catalogue)).toEqual([...(await locale.languages())]);
            for (const lang of await locale.languages()) {
                expect(catalogue[lang]).toEqual(flattenLocaleMessages(messages(json, lang)));
                expect(catalogue[lang]!.locale).toBe(lang);
            }
            expect(catalogue.fr).toMatchObject({empty: "", pluginItems: "élément plugin|éléments plugin"});
        }
    );

    test("validates the catalogue directly and recovers after clearing invalid sources", async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-locale-catalogue-"));
        temporaryDirectories.push(root);
        fs.cpSync(path.join(fixtures, "missing-plural"), root, {recursive: true});
        const locale = makeLocale("missing-plural", {rootDir: root});
        await expect(locale.catalogue()).rejects.toThrow('missing plural key "cart.items"');
        fs.cpSync(path.join(fixtures, "single"), root, {recursive: true});
        locale.clear();
        expect((await locale.catalogue()).fr!.cart_items).toBe("{{count}} article|{{count}} articles");
    });
});
