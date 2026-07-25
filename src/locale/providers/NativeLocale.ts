import {getI18nMessage} from "@addon-core/browser";

import {defaultLanguage, keys as localeKeys, locales as localeLanguages} from "adnbn/virtual/locale";

import AbstractLocale from "./AbstractLocale";

import {convertLocaleKey, resolveLanguage} from "@locale/utils";

import {Language, LocaleCustomKeyForLanguage, LocaleProvider, LocaleStructure} from "@typing/locale";

export interface LocaleNativeStructure extends LocaleStructure {}

export default class NativeLocale<S extends object = LocaleNativeStructure> extends AbstractLocale<S> {
    private static instance?: LocaleProvider<LocaleNativeStructure>;

    public static getInstance(): LocaleProvider<LocaleNativeStructure> {
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

        if (markerLang && !resolvedLang) {
            console.warn(`[NativeLocale] Unsupported language marker: "${markerLang}".`);
        }

        if (markerLang && resolvedLang && markerLang !== resolvedLang) {
            console.info(`[NativeLocale] Language normalized: using "${resolvedLang}" instead of "${markerLang}".`);
        }

        // The i18n marker is only readable once the extension is (re)loaded with default_locale and
        // _locales — chrome.i18n caches them at load, so a dev rebuild alone does not refresh it.
        // Until then (or for a non-localized build) fall back to the build-time default language so a
        // view that calls t() renders untranslated keys instead of throwing and white-screening.
        this.language = resolvedLang ?? resolveLanguage(defaultLanguage);

        if (!this.language) {
            console.warn("[NativeLocale] No supported locale resolved; localization is inactive.");
        }
    }

    public lang(): Language {
        // Never throw — a missing language must not crash a view; degrade to a sane default.
        return this.language ?? Language.English;
    }

    public keys(): Set<keyof S> {
        // `adnbn/virtual/locale` is the data module published by the locale bundler plugin
        // (src/cli/plugins/locale/index.ts). Inside an adnbn build it carries the real keys; the
        // published stub exports an empty array so this never throws outside an adnbn build.
        return new Set(localeKeys) as Set<keyof S>;
    }

    public languages(): Set<Language> {
        return new Set(localeLanguages) as Set<Language>;
    }

    protected value(key: Extract<keyof S, string>): string | undefined {
        const value = getI18nMessage(convertLocaleKey(key));

        if (!value || value.length === 0) {
            return undefined;
        }

        return value;
    }
}
