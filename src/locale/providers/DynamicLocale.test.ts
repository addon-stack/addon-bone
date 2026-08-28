jest.mock("@addon-core/browser", () => ({
    getI18nMessage: jest.fn(() => "en"),
}));

import DynamicLocale from "./DynamicLocale";
import CustomLocale, {CustomLocaleData} from "./CustomLocale";

import {getI18nMessage} from "@addon-core/browser";
import {Language} from "@typing/locale";

interface Structure {
    empty: {plural: false; substitutions: []};
}

class TestDynamicLocale extends DynamicLocale<Structure> {
    public setLocale(lang: Language, data: CustomLocaleData): this {
        this.locale = new CustomLocale<Structure>(lang, data);

        return this;
    }
}

describe("DynamicLocale", () => {
    const keysDescriptor = Object.getOwnPropertyDescriptor(globalThis, "__ADNBN_LOCALE_KEYS__");

    beforeEach(() => {
        Object.defineProperty(globalThis, "__ADNBN_LOCALE_KEYS__", {
            configurable: true,
            value: ["empty"],
        });
        jest.mocked(getI18nMessage).mockReset().mockReturnValue("en");
    });

    afterEach(() => {
        if (keysDescriptor) {
            Object.defineProperty(globalThis, "__ADNBN_LOCALE_KEYS__", keysDescriptor);
        } else {
            Reflect.deleteProperty(globalThis, "__ADNBN_LOCALE_KEYS__");
        }
        jest.restoreAllMocks();
    });

    describe("languageNames()", () => {
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, "__ADNBN_DEFINED_LOCALES__");

        beforeEach(() => {
            Object.defineProperty(globalThis, "__ADNBN_DEFINED_LOCALES__", {
                configurable: true,
                value: [Language.French, Language.EnglishGreatBritain, Language.Ukrainian],
            });
        });

        afterEach(() => {
            if (descriptor) {
                Object.defineProperty(globalThis, "__ADNBN_DEFINED_LOCALES__", descriptor);
            } else {
                Reflect.deleteProperty(globalThis, "__ADNBN_DEFINED_LOCALES__");
            }
        });

        test("exposes only build languages in their original order", () => {
            const locale = new DynamicLocale(false);

            expect([...locale.languageNames()]).toEqual([
                [Language.French, "Français"],
                [Language.EnglishGreatBritain, "English (United Kingdom)"],
                [Language.Ukrainian, "Українська"],
            ]);
            expect([...locale.languageNames().keys()]).toEqual([...locale.languages()]);
            expect(locale.languageNames().has(Language.German)).toBe(false);
        });

        test("returns independent maps without changing the language names", () => {
            const locale = new DynamicLocale(false);
            const changed = locale.languageNames();
            const original = locale.languageNames();

            expect(changed).not.toBe(original);
            changed.set(Language.French, "Changed");
            changed.delete(Language.Ukrainian);

            expect(original.get(Language.French)).toBe("Français");
            expect(original.get(Language.Ukrainian)).toBe("Українська");
            expect(locale.languageNames()).toEqual(original);
        });

        test("returns an empty map for a build without locales", () => {
            Object.defineProperty(globalThis, "__ADNBN_DEFINED_LOCALES__", {value: []});

            expect(new DynamicLocale(false).languageNames()).toEqual(new Map());
        });
    });

    test("preserves an empty native message before loading a dynamic catalog", () => {
        jest.mocked(getI18nMessage).mockImplementation(key => (key === "locale" ? "ru" : ""));
        const warn = jest.spyOn(console, "warn").mockImplementation();
        const locale = new DynamicLocale<Structure>(false);

        expect(locale.lang()).toBe(Language.Russian);
        expect(locale.trans("empty")).toBe("");
        expect(warn).not.toHaveBeenCalled();
    });

    test("does not fall back to native locale when dynamic value is empty", () => {
        const locale = new TestDynamicLocale(false).setLocale(Language.French, {
            empty: "",
        });

        expect(locale.trans("empty")).toBe("");
    });
});
