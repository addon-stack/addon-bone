import {Language, LanguageCodes, LocaleDir, RtlLanguages} from "@typing/locale";

export const isLocaleRtl = (lang: Language): boolean => {
    return RtlLanguages.has(lang);
};

export const getLocaleDir = (lang: Language): LocaleDir => {
    return isLocaleRtl(lang) ? LocaleDir.RightToLeft : LocaleDir.LeftToRight;
};

export const resolveLanguage = (language?: string): Language | undefined => {
    if (!language) {
        return undefined;
    }

    if (LanguageCodes.has(language as Language)) {
        return language as Language;
    }

    const shortLang = language.slice(0, 2) as Language;

    return LanguageCodes.has(shortLang) ? shortLang : undefined;
};
