import {getI18nMessage} from "@addon-core/browser";
import {keys, languages} from "#adnbn/locale";

import AbstractLocale from "./AbstractLocale";

import {convertLocaleKey, resolveLanguage} from "@shared/locale";

import {Language, LocaleCustomKeyForLanguage, type LocaleProvider, type LocaleRegistry} from "@typing/locale";

export default class NativeLocale<S extends object = LocaleRegistry> extends AbstractLocale<S> {
    private static instance?: LocaleProvider<LocaleRegistry>;

    public static getInstance(): LocaleProvider<LocaleRegistry> {
        return (NativeLocale.instance ??= new NativeLocale());
    }

    private readonly language?: Language;

    constructor() {
        super();

        /**
         Locale detection note:
         Chrome does NOT expose an API to get the effective translation locale.
         getUILanguage() returns browser UI language (e.g., es-MX),
         even if extension translations fall back to default_locale (e.g., en).
         To detect the actual language used by i18n, we read a locale marker
         from messages.json via chrome.i18n.getMessage().
         */
        const markerLang = getI18nMessage(LocaleCustomKeyForLanguage);
        const resolvedLang = resolveLanguage(markerLang);

        if (!resolvedLang) {
            console.warn(`[NativeLocale] Unsupported language detected: "${markerLang}".`);
        }

        if (markerLang && resolvedLang && markerLang !== resolvedLang) {
            console.info(`[NativeLocale] Language normalized: using "${resolvedLang}" instead of "${markerLang}".`);
        }

        this.language = resolvedLang;
    }

    public lang(): Language {
        if (!this.language) {
            throw new Error("[NativeLocale] Language is not defined. Failed to determine a supported locale.");
        }

        return this.language;
    }

    public keys(): Set<keyof S> {
        return new Set(keys) as Set<keyof S>;
    }

    public languages(): Set<Language> {
        return new Set(languages);
    }

    protected value(key: Extract<keyof S, string>): string | undefined {
        const value = getI18nMessage(convertLocaleKey(key));

        // Native i18n returns an empty string for missing messages too; build keys distinguish valid empty translations.
        if (value === "" && !this.keys().has(key)) {
            return undefined;
        }

        return value;
    }
}
