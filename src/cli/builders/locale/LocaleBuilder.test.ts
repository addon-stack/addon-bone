import LocaleBuilder from "./LocaleBuilder";

import {Language, LocaleCustomKeyForLanguage, LocaleValuesSeparator} from "@typing/locale";
import {Browser} from "@typing/browser";

const makeValidator = () => ({
    isValid: jest.fn(),
    validate: jest.fn(),
});

describe("LocaleBuilder", () => {
    test("returns the builder language", () => {
        expect(new LocaleBuilder(Browser.Chrome, Language.French).lang()).toBe(Language.French);
    });

    test("flattens nested data, stringifies values and injects the language marker", () => {
        const builder = new LocaleBuilder(Browser.Chrome, Language.English).merge({
            app: {
                name: "My App",
                version: 2,
                items: ["one", 2],
            },
        });

        expect(Object.fromEntries(builder.get())).toEqual({
            "app.name": "My App",
            "app.version": "2",
            "app.items": ["one", "2"].join(LocaleValuesSeparator),
            [LocaleCustomKeyForLanguage]: Language.English,
        });
    });

    test("lets later merged data override earlier values and clears cached items", () => {
        const builder = new LocaleBuilder(Browser.Chrome, Language.English).merge({
            title: "Before",
        });

        const first = builder.get();

        builder.merge({
            title: "After",
        });

        const second = builder.get();

        expect(second).not.toBe(first);
        expect(second.get("title")).toBe("After");
    });

    test("returns locale keys from converted items", () => {
        const builder = new LocaleBuilder(Browser.Chrome, Language.English).merge({
            app: {
                name: "My App",
            },
        });

        expect(builder.keys()).toEqual(new Set(["app.name", LocaleCustomKeyForLanguage]));
    });

    test("normalizes substitution names in locale structure", () => {
        const builder = new LocaleBuilder(Browser.Chrome, Language.English).merge({
            greeting: "Hello {{ name }} {{name}} {{ count }}",
            cars: ["{{count}} car", "{{count}} cars"],
        });

        expect(builder.structure().greeting.substitutions).toEqual(["count", "name"]);
        expect(builder.structure().cars).toEqual({
            plural: true,
            substitutions: ["count"],
        });
    });

    test("builds browser messages and validates before output", () => {
        const validator = makeValidator();
        const builder = new LocaleBuilder(Browser.Chrome, Language.English).setValidator(validator).merge({
            app: {
                name: "My App",
            },
        });

        expect(builder.build()).toEqual({
            app_name: {
                message: "My App",
            },
            [LocaleCustomKeyForLanguage]: {
                message: Language.English,
            },
        });

        expect(validator.validate).toHaveBeenCalledWith(builder);
    });

    test("throws validation errors when validator is not set", () => {
        const builder = new LocaleBuilder(Browser.Chrome, Language.English);

        expect(() => builder.validate()).toThrow("Locale for chrome:en - Validator is not set");
        expect(builder.isValid()).toBe(false);
    });

    test("reports validation status from configured validator", () => {
        const passingValidator = makeValidator();
        const failingValidator = makeValidator();

        failingValidator.validate.mockImplementation(() => {
            throw new Error("Invalid locale");
        });

        const passing = new LocaleBuilder(Browser.Chrome, Language.English).setValidator(passingValidator);
        const failing = new LocaleBuilder(Browser.Chrome, Language.English).setValidator(failingValidator);

        expect(passing.validate()).toBe(passing);
        expect(passing.isValid()).toBe(true);
        expect(failing.isValid()).toBe(false);
    });
});
