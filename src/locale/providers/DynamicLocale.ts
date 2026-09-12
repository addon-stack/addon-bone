import {getI18nMessage} from "@addon-core/browser";

import catalogue, {keys, lang as defaultLanguage, languages} from "#adnbn/locale";

import AbstractLocale from "./AbstractLocale";
import {LocaleStorage} from "../storage";

import {convertLocaleKey, resolveLanguage} from "@shared/locale";
import {
    Language,
    LocaleCustomKeyForLanguage,
    type LocaleDynamicProvider,
    type LocaleRegistry,
    type LocaleStorageDriver,
} from "@typing/locale";

export default class DynamicLocale<T extends object = LocaleRegistry>
    extends AbstractLocale<T>
    implements LocaleDynamicProvider<T>
{
    private language!: Language;
    private data!: Readonly<Record<string, string>>;

    protected storage?: LocaleStorageDriver;
    protected unsubscribe?: () => void;

    constructor(storage?: LocaleStorageDriver | false) {
        super();

        let marker: string | undefined;

        try {
            marker = getI18nMessage(LocaleCustomKeyForLanguage);
        } catch {
            // MAIN has no extension i18n; use the configured language from the bundled catalogue.
        }

        this.select(resolveLanguage(marker) ?? defaultLanguage);

        this.storage = storage === false ? undefined : (storage ?? new LocaleStorage());
    }

    /**
     * Selects a language synchronously without saving it.
     * With storage enabled, a later sync() or watched storage update can replace this local selection.
     * @throws If the language is absent from the catalogue.
     */
    public select(lang: Language): Language {
        if (!Object.hasOwn(catalogue, lang)) {
            throw new Error(`[DynamicLocale] Language "${lang}" is not available in the catalogue.`);
        }

        this.language = lang;
        this.data = catalogue[lang]!;

        return lang;
    }

    /** Selects a language immediately and saves it when storage is enabled. */
    public async change(lang: Language): Promise<Language> {
        this.select(lang);

        if (this.storage) {
            await this.storage.set(lang);
        }

        return lang;
    }

    public async sync(): Promise<Language> {
        if (!this.storage) {
            throw new Error("Language is not saving in storage");
        }

        const lang = await this.storage.get();

        if (!lang) {
            return this.lang();
        }

        if (!Object.hasOwn(catalogue, lang)) {
            console.warn(`Incorrect language code in storage - "${lang}"`);

            return this.lang();
        }

        return this.select(lang);
    }

    public watch(handler?: (lang: Language) => void): () => void {
        if (!this.storage) {
            throw new Error("Language is not saved in storage");
        }

        if (this.unsubscribe) {
            throw new Error("Already subscribed to language changes in storage");
        }

        this.unsubscribe = this.storage.watch(lang => {
            try {
                this.select(lang);
                handler?.(lang);
            } catch (error) {
                console.error("Error while changing language:", error);
            }
        });

        return this.unwatch.bind(this);
    }

    public unwatch(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
    }

    public lang(): Language {
        return this.language;
    }

    /** Completed messages for the current language, with underscore keys and no substitutions applied. */
    public messages(): Readonly<Record<string, string>> {
        return this.data;
    }

    public keys(): Set<keyof T> {
        return new Set(keys) as Set<keyof T>;
    }

    public langs(): ReadonlySet<Language> {
        return new Set(languages);
    }

    protected value(key: Extract<keyof T, string>): string | undefined {
        const name = convertLocaleKey(key);

        return Object.hasOwn(this.data, name) ? this.data[name] : undefined;
    }
}
