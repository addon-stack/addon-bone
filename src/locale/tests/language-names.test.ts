import {Language, LanguageNames} from "@typing/locale";

describe("LanguageNames", () => {
    test("has a nonempty native title for every supported language", () => {
        expect(Object.keys(LanguageNames).sort()).toEqual(Object.values(Language).sort());
        expect(Object.values(LanguageNames).every(name => name.trim().length > 0)).toBe(true);
        expect(LanguageNames[Language.PortugueseBrazil]).toBe("Português (Brasil)");
        expect(LanguageNames[Language.PortuguesePortugal]).toBe("Português (Portugal)");
        expect(LanguageNames[Language.ChineseChina]).toBe("中文（简体）");
        expect(LanguageNames[Language.ChineseTaiwan]).toBe("中文（繁體）");
        expect(LanguageNames[Language.EnglishAustralia]).toBe("English (Australia)");
        expect(LanguageNames[Language.EnglishUSA]).toBe("English (United States)");
        expect(LanguageNames[Language.SpanishLatinAmericaAndCaribbean]).toBe("Español (Latinoamérica y el Caribe)");
    });
});
