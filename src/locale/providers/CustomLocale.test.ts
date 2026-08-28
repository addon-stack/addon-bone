import CustomLocale from "./CustomLocale";

import {Language, LocaleValuesSeparator} from "@typing/locale";

describe("CustomLocale", () => {
    const mockMessages = {
        title: "Adnbn",
        greeting: "Hello {{name}}",
        spacedGreeting: "Hello {{ name }}",
        empty: "",
    };

    const locale = new CustomLocale(Language.English, mockMessages);
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
        locale.setLang(Language.English).setData(mockMessages);
        consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
    });

    test("change() - changed language and messages", () => {
        const messages = {greeting: "Bonjour"};
        locale.setLang(Language.French).setData(messages);

        expect(locale.lang()).toBe(Language.French);
        expect(locale["data"]).toEqual(messages);
    });

    test("keys() - returned all message keys", () => {
        const keys = locale.keys();

        expect(keys).toBeInstanceOf(Set);
        Object.keys(mockMessages).forEach(key => expect(keys).toContain(key));
    });

    test("lang() - returned language", () => {
        expect(locale.lang()).toBe(Language.English);
    });

    test("languageNames() - follows the provider's languages", () => {
        locale.setLang(Language.French);
        expect(locale.languageNames()).toEqual(new Map([[Language.French, "Français"]]));

        locale.setLang(Language.Ukrainian);
        expect(locale.languageNames()).toEqual(new Map([[Language.Ukrainian, "Українська"]]));
    });

    describe("trans()", () => {
        test("returned the correct message if key exists and is non-empty", () => {
            expect(locale.trans("title" as never)).toBe("Adnbn");
        });

        test("returned the correct message with substitutions", () => {
            expect(locale.trans("greeting" as never, {name: "Alice"})).toBe("Hello Alice");
        });

        test("returned the correct message with spaced substitutions", () => {
            expect(locale.trans("spacedGreeting" as never, {name: "Alice"})).toBe("Hello Alice");
        });

        test("returned placeholder name if substitution is missing", () => {
            expect(locale.trans("greeting" as never, {firstName: "Alice"})).toBe("Hello name");
        });

        test("returned key instead value if key does not exist", () => {
            expect(locale.trans("test" as never)).toBe("test");
            expect(consoleWarnSpy).toHaveBeenCalledWith('Locale key "test" not found in "en" language.');
        });

        test("returned empty value if message is empty", () => {
            expect(locale.trans("empty" as never)).toBe("");
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });

    describe("choice()", () => {
        const key = "car" as never;

        test("languages with 1 plural forms", () => {
            const arr = ["車"];
            const messages = {[key]: arr.join(LocaleValuesSeparator)};

            locale.setLang(Language.Japanese).setData(messages);

            expect(locale.choice(key, 0)).toBe(arr[0]);
            expect(locale.choice(key, 1)).toBe(arr[0]);
            expect(locale.choice(key, 2)).toBe(arr[0]);
        });

        test("languages with 2 plural forms - 0 is plural", () => {
            const arr = ["car", "cars"];
            const messages = {[key]: arr.join(LocaleValuesSeparator)};

            locale.setLang(Language.English).setData(messages);

            expect(locale.choice(key, 0)).toBe(arr[1]);
            expect(locale.choice(key, 1)).toBe(arr[0]);
            expect(locale.choice(key, 2)).toBe(arr[1]);
        });

        test("languages with 2 plural forms - 0 is singular", () => {
            const arr = ["voiture", "voitures"];
            const messages = {[key]: arr.join(LocaleValuesSeparator)};

            locale.setLang(Language.French).setData(messages);

            expect(locale.choice(key, 0)).toBe(arr[0]);
            expect(locale.choice(key, 1)).toBe(arr[0]);
            expect(locale.choice(key, 2)).toBe(arr[1]);
        });

        test("languages with 2 plural forms - Latvian", () => {
            const arr = ["mašīnu", "mašīna", "mašīnas"];
            const messages = {[key]: arr.join(LocaleValuesSeparator)};

            locale.setLang(Language.Latvian).setData(messages);

            // Only 0
            expect(locale.choice(key, 0)).toBe(arr[0]);

            // Last number 1 but not 11
            [1, 21, 101].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[1]);
            });

            // All other numbers
            [3, 5, 11, 15].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[2]);
            });
        });

        test("languages with 3 plural forms - Russian", () => {
            const arr = ["машина", "машины", "машин"];
            const messages = {[key]: arr.join(LocaleValuesSeparator)};

            locale.setLang(Language.Russian).setData(messages);

            // Last number 1 but not 11
            [1, 21, 31, 101].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[0]);
            });

            // Last number 2, 3, 4 but not two last 12, 13, 14
            [2, 22, 102].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[1]);
            });

            // Other numbers
            [0, 5, 6, 7, 8, 9, 10, 11, 12, 112].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[2]);
            });
        });

        test("languages with 3 plural forms - Czech, Slovak", () => {
            const arr = ["auto", "auta", "aut"];
            const messages = {[key]: arr.join(LocaleValuesSeparator)};

            locale.setLang(Language.Czech).setData(messages);

            // Only 1
            expect(locale.choice(key, 1)).toBe(arr[0]);

            // Only 2,3,4
            [2, 3, 4].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[1]);
            });

            // All other numbers
            [0, 5, 8, 10, 55].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[2]);
            });
        });

        test("languages with 3 plural forms - Lithuanian", () => {
            const arr = ["mašina", "mašinos", "mašinų"];
            const messages = {[key]: arr.join(LocaleValuesSeparator)};

            locale.setLang(Language.Lithuanian).setData(messages);

            // Last number 1 but not 11
            [1, 21, 31, 101].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[0]);
            });

            // Last number 2, 3, 4, 5, 6, 7, 8, 9 but not two last 12, 13, 14, 15, 16, 17, 18, 19
            [2, 3, 24, 25, 106, 107, 208, 209].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[1]);
            });

            // All other numbers
            [0, 10, 11, 15, 117].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[2]);
            });
        });

        test("languages with 3 plural forms - Polish", () => {
            const arr = ["samochód", "samochody", "samochodów"];
            const messages = {[key]: arr.join(LocaleValuesSeparator)};

            locale.setLang(Language.Polish).setData(messages);

            // For only 1
            expect(locale.choice(key, 1)).toBe(arr[0]);

            // Last number 2, 3, 4 but not two last 12, 13, 14
            [2, 3, 4, 22, 23, 24].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[1]);
            });

            // All other numbers
            [0, 5, 6, 12, 13, 14].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[2]);
            });
        });

        test("languages with 3 plural forms - Romanian", () => {
            const arr = ["samochód", "samochody", "samochodów"];
            const messages = {[key]: arr.join(LocaleValuesSeparator)};

            locale.setLang(Language.Romanian).setData(messages);

            // For only 1
            expect(locale.choice(key, 1)).toBe(arr[0]);

            // 0, more than 1 and less than 20
            [0, 2, 11, 14, 19].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[1]);
            });

            // All other numbers
            [20, 25, 100].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[2]);
            });
        });

        test("languages with 4 plural forms - Slovenian", () => {
            const arr = ["avto", "avta", "avti", "avtov"];
            const messages = {[key]: arr.join(LocaleValuesSeparator)};

            locale.setLang(Language.Slovenian).setData(messages);

            // Last two numbers 1
            [1, 101].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[0]);
            });

            // Last two numbers number 2
            [2, 102].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[1]);
            });

            // Last two numbers 3, 4
            [3, 103, 4, 104].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[2]);
            });

            // All other numbers
            [5, 6, 17, 18, 119, 120].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[3]);
            });
        });

        test("languages with 6 plural forms - Arabic", () => {
            const arr = ["لا سيارات", "سيارة", "سيارتان", "سيارات", "سيارات", "سيارات"];
            const messages = {[key]: arr.join(LocaleValuesSeparator)};

            locale.setLang(Language.Arabic).setData(messages);

            // For only 0
            expect(locale.choice(key, 0)).toBe(arr[0]);

            // For only 1
            expect(locale.choice(key, 1)).toBe(arr[1]);

            // For only 2
            expect(locale.choice(key, 2)).toBe(arr[2]);

            // last two numbers 3<= and >=10
            [3, 4, 5, 10, 106, 107, 108, 110].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[3]);
            });

            // last two numbers 11<= and >=99
            [11, 25, 115, 199].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[4]);
            });

            // All other numbers
            [100, 101, 102].forEach(item => {
                expect(locale.choice(key, item)).toBe(arr[5]);
            });
        });
    });
});
