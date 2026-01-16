import {
    Language,
    LanguageCodes,
    LocaleDir,
    LocaleKeyMarker,
    LocaleKeysSeparator,
    LocaleMessages,
    LocaleNestedKeysSeparator,
    RtlLanguages,
} from "@typing/locale";

export const getLocaleFilename = (lang: Language): string => {
    return `_locales/${lang}/messages.json`;
};

export const convertLocaleKey = (key: string): string => {
    return key.replaceAll(LocaleNestedKeysSeparator, LocaleKeysSeparator);
};

export const convertLocaleMessageKey = (key: string): string => {
    return `__MSG_${convertLocaleKey(key)}__`;
};

export const extractLocaleKey = (key?: string): string | undefined => {
    if (isLocaleKey(key)) {
        return key.substring(1);
    }
};

export const isLocaleKey = (key?: string): key is string => {
    return key?.startsWith(LocaleKeyMarker) ?? false;
};

export const modifyLocaleMessageKey = (key?: string): string | undefined => {
    if (typeof key !== "string") {
        return undefined;
    }

    const localeKey = extractLocaleKey(key);

    if (localeKey) {
        return convertLocaleMessageKey(localeKey);
    }

    return key;
};

export const isLocaleRtl = (lang: Language): boolean => {
    return RtlLanguages.has(lang);
};

export const getLocaleDir = (lang: Language): LocaleDir => {
    return isLocaleRtl(lang) ? LocaleDir.RightToLeft : LocaleDir.LeftToRight;
};

export const flattenLocaleMessages = (messages: LocaleMessages): Record<string, string> => {
    return Object.fromEntries(Object.entries(messages).map(([key, value]) => [key, value.message]));
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
