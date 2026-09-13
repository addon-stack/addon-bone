import type {Language, LocaleMessages} from "@typing/locale";

export const getLocaleFilename = (lang: Language): string => {
    return `_locales/${lang}/messages.json`;
};

export const flattenLocaleMessages = (messages: LocaleMessages): Record<string, string> =>
    Object.fromEntries(Object.entries(messages).map(([key, value]) => [key, value.message]));
