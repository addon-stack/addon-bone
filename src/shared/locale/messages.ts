import type {Language, LocaleMessages} from "@typing/locale";

/** Native i18n consumes the first dollar in each escaped run; the catalogue keeps the original text. */
export const escapeLocaleMessage = (message: string): string => message.replace(/\$+/g, dollars => "$" + dollars);

/** Protects literal $NAME$ text from the earlier named-placeholder pass as well. */
export const escapeLocaleMessages = (messages: LocaleMessages): LocaleMessages =>
    Object.fromEntries(
        Object.entries(messages).map(([key, value]) => {
            const message = escapeLocaleMessage(value.message);

            return [
                key,
                /\$[a-z0-9_@]+\$/i.test(value.message)
                    ? {...value, message: "$text$", placeholders: {text: {content: message}}}
                    : {...value, message},
            ];
        })
    );

export const getLocaleFilename = (lang: Language): string => {
    return `_locales/${lang}/messages.json`;
};

export const flattenLocaleMessages = (messages: LocaleMessages): Record<string, string> =>
    Object.fromEntries(Object.entries(messages).map(([key, value]) => [key, value.message]));
