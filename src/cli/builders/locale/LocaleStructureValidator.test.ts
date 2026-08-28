import LocaleBuilder from "./LocaleBuilder";
import LocaleStructureValidator from "./LocaleStructureValidator";

import {Language, LocaleBuilders, LocaleData} from "@typing/locale";
import {Browser} from "@typing/browser";

const makeBuilder = (lang: Language, data: LocaleData): LocaleBuilder => {
    return new LocaleBuilder(Browser.Chrome, lang).merge(data);
};

const makeBuilders = (items: Array<[Language, LocaleData]>): LocaleBuilders => {
    return new Map(items.map(([lang, data]) => [lang, makeBuilder(lang, data)]));
};

describe("LocaleStructureValidator", () => {
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
    });

    test("allows non-default locales to omit default locale keys", () => {
        const builders = makeBuilders([
            [
                Language.English,
                {
                    app: {
                        name: "My App",
                        greeting: "Hello {{name}}",
                    },
                },
            ],
            [
                Language.French,
                {
                    app: {
                        name: "Mon App",
                    },
                },
            ],
        ]);

        const validator = new LocaleStructureValidator(Language.English);

        expect(validator.validate(builders)).toBe(validator);
        expect(validator.isValid(builders)).toBe(true);
    });

    test("rejects missing default locale", () => {
        const builders = makeBuilders([
            [
                Language.French,
                {
                    app: {
                        name: "Mon App",
                    },
                },
            ],
        ]);

        expect(() => new LocaleStructureValidator(Language.English).validate(builders)).toThrow(
            'Default locale "en" not found in available translations. Available languages: fr'
        );
    });

    test("rejects an omitted plural key before default-locale completion", () => {
        const builders = makeBuilders([
            [Language.English, {cart: {items: ["{{count}} item", "{{count}} items"]}}],
            [Language.French, {title: "Panier"}],
        ]);

        const validator = new LocaleStructureValidator(Language.English);

        expect(() => validator.validate(builders)).toThrow(
            'Locale "fr" is missing plural key "cart.items" required by default locale "en"'
        );
        expect(validator.isValid(builders)).toBe(false);
    });

    test("accepts a target-language plural supplied by an earlier merge", () => {
        const builders = makeBuilders([
            [Language.English, {cart: {items: ["item", "items"]}}],
            [Language.French, {cart: {items: ["article", "articles"]}}],
        ]);

        builders.get(Language.French)!.merge({title: "Panier"});

        expect(new LocaleStructureValidator(Language.English).isValid(builders)).toBe(true);
    });

    test("warns about keys outside the default locale contract", () => {
        const builders = makeBuilders([
            [Language.English, {app: {name: "My App"}}],
            [Language.French, {app: {name: "Mon App", extra: "Extra"}}],
        ]);

        const validator = new LocaleStructureValidator(Language.English);

        expect(validator.validate(builders)).toBe(validator);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'Locale "fr" contains unknown key "app.extra" not found in default locale "en"'
        );
        expect(validator.isValid(builders)).toBe(true);
    });

    test("rejects substitution mismatch against the default locale contract", () => {
        const builders = makeBuilders([
            [Language.English, {app: {greeting: "Hello {{ name }}"}}],
            [Language.French, {app: {greeting: "Bonjour {{firstName}}"}}],
        ]);

        const validator = new LocaleStructureValidator(Language.English);

        expect(() => validator.validate(builders)).toThrow(
            'Locale "fr" key "app.greeting" substitutions [firstName] must match default locale "en" substitutions [name]'
        );
        expect(validator.isValid(builders)).toBe(false);
    });

    test("rejects plural mismatch against the default locale contract", () => {
        const builders = makeBuilders([
            [Language.English, {app: {cars: ["car", "cars"]}}],
            [Language.French, {app: {cars: "voiture"}}],
        ]);

        expect(() => new LocaleStructureValidator(Language.English).validate(builders)).toThrow(
            'Locale "fr" key "app.cars" must be plural like default locale "en"'
        );
    });

    test("allows empty builder collection", () => {
        const builders: LocaleBuilders = new Map();
        const validator = new LocaleStructureValidator(Language.English);

        expect(validator.validate(builders)).toBe(validator);
        expect(validator.isValid(builders)).toBe(true);
    });
});
