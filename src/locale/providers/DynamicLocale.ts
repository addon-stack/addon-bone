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
    private messages!: Record<string, string>;

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

    public keys(): Set<keyof T> {
        return new Set(keys) as Set<keyof T>;
    }

    public languages(): Set<Language> {
        return new Set(languages);
    }

    protected value(key: Extract<keyof T, string>): string | undefined {
        const name = convertLocaleKey(key);

        return Object.hasOwn(this.messages, name) ? this.messages[name] : undefined;
    }

    private select(lang: Language): Language {
        if (!Object.hasOwn(catalogue, lang)) {
            throw new Error(`[DynamicLocale] Language "${lang}" is not available in the catalogue.`);
        }

        this.language = lang;
        this.messages = catalogue[lang]!;

        return lang;
    }
}
