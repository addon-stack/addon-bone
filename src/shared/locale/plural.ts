import {Language, LocaleValuesSeparator} from "@typing/locale";

export const selectPluralForm = (message: string, lang: Language, count: number): string => {
    const parts = message.split(LocaleValuesSeparator);

    return parts[getPluralIndex(lang, count)] ?? parts[0] ?? message;
};

const getPluralIndex = (lang: Language, count: number): number => {
    switch (lang) {
        case Language.Indonesian:
        case Language.Japanese:
        case Language.Kannada:
        case Language.Korean:
        case Language.Malay:
        case Language.Thai:
        case Language.Turkish:
        case Language.Vietnamese:
            return 0;

        case Language.Bengali:
        case Language.Bulgarian:
        case Language.Catalan:
        case Language.Danish:
        case Language.German:
        case Language.Greek:
        case Language.English:
        case Language.EnglishAustralia:
        case Language.EnglishGreatBritain:
        case Language.EnglishUSA:
        case Language.Spanish:
        case Language.SpanishLatinAmericaAndCaribbean:
        case Language.Estonian:
        case Language.Persian:
        case Language.Finnish:
        case Language.Gujarati:
        case Language.Hebrew:
        case Language.Hungarian:
        case Language.Italian:
        case Language.Malayalam:
        case Language.Marathi:
        case Language.Dutch:
        case Language.Norwegian:
        case Language.Swedish:
        case Language.Swahili:
        case Language.Tamil:
        case Language.Telugu:
        case Language.ChineseChina:
        case Language.ChineseTaiwan:
        case Language.PortugueseBrazil:
        case Language.PortuguesePortugal:
            return count == 1 ? 0 : 1;

        case Language.Amharic:
        case Language.Filipino:
        case Language.French:
        case Language.Hindi:
            return count == 0 || count == 1 ? 0 : 1;

        case Language.Croatian:
        case Language.Russian:
        case Language.Serbian:
        case Language.Ukrainian:
            return count % 10 == 1 && count % 100 != 11
                ? 0
                : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)
                  ? 1
                  : 2;

        case Language.Czech:
        case Language.Slovak:
            return count == 1 ? 0 : count >= 2 && count <= 4 ? 1 : 2;

        case Language.Lithuanian:
            return count % 10 == 1 && count % 100 != 11
                ? 0
                : count % 10 >= 2 && (count % 100 < 10 || count % 100 >= 20)
                  ? 1
                  : 2;

        case Language.Slovenian:
            return count % 100 == 1 ? 0 : count % 100 == 2 ? 1 : count % 100 == 3 || count % 100 == 4 ? 2 : 3;

        case Language.Latvian:
            return count == 0 ? 0 : count % 10 == 1 && count % 100 != 11 ? 1 : 2;

        case Language.Polish:
            return count == 1
                ? 0
                : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)
                  ? 1
                  : 2;

        case Language.Romanian:
            return count == 1 ? 0 : count == 0 || (count % 100 > 0 && count % 100 < 20) ? 1 : 2;

        case Language.Arabic:
            return count == 0
                ? 0
                : count == 1
                  ? 1
                  : count == 2
                    ? 2
                    : count % 100 >= 3 && count % 100 <= 10
                      ? 3
                      : count % 100 >= 11 && count % 100 <= 99
                        ? 4
                        : 5;

        default:
            return 0;
    }
};
