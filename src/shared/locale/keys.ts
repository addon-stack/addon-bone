import {LocaleKeyMarker, LocaleKeysSeparator, LocaleNestedKeysSeparator} from "@typing/locale";

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
