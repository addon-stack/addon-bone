import {flattenLocaleMessages, getLocaleFilename} from "../utils";

import {Storage} from "@storage/providers";

import NativeLocale, {LocaleNativeStructure} from "./NativeLocale";
import CustomLocale, {CustomLocaleData} from "./CustomLocale";

import {Language, LanguageCodes, LocaleDynamicProvider, LocaleMessages} from "@typing/locale";
import {StorageProvider} from "@typing/storage";

export default class<T extends LocaleNativeStructure> extends NativeLocale implements LocaleDynamicProvider<T> {
    protected cache = new Map<Language, CustomLocaleData>();

    protected locale?: CustomLocale<T>;

    protected storage?: StorageProvider<Record<string, Language>>;
    protected storageKey?: string;

    protected unsubscribe?: () => void;

    constructor(storage: string | false = "lang") {
        super();

        if (storage) {
            this.storageKey = storage;
            this.storage = Storage.Local();
        }
    }

    public async change(lang: Language): Promise<Language> {
        if (lang === this.lang()) {
            return lang;
        }

        const messages = await this.fetch(lang);

        (this.locale ??= new CustomLocale()).setLang(lang).setData(messages);

        if (this.storage && this.storageKey) {
            await this.storage.set(this.storageKey, lang);
        }

        return lang;
    }

    public async sync(): Promise<Language> {
        if (!this.storage || !this.storageKey) {
            throw new Error("Language is not saving in storage");
        }

        const lang = await this.storage.get(this.storageKey);

        if (!lang) {
            return this.lang();
        }

        if (!LanguageCodes.has(lang)) {
            console.warn(`Incorrect language code in storage - "${lang}"`);

            return this.lang();
        }

        return this.change(lang);
    }

    public watch(handler?: (lang: Language) => void): () => void {
        if (!this.storage || !this.storageKey) {
            throw new Error("Language is not saved in storage");
        }

        if (this.unsubscribe) {
            throw new Error("Already subscribed to language changes in storage");
        }

        this.unsubscribe = this.storage.watch({
            [this.storageKey]: newValue => {
                if (newValue) {
                    this.change(newValue)
                        .then(() => handler && handler(newValue))
                        .catch(err => console.error("Error while changing language:", err));
                }
            },
        });

        return this.unwatch.bind(this);
    }

    public unwatch(): void {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
    }

    public lang(): Language {
        return this.locale?.lang() || super.lang();
    }

    protected value(key: Extract<keyof LocaleNativeStructure, string>): string | undefined {
        return this.locale?.get(key) || super.value(key);
    }

    protected async fetch(lang: Language): Promise<CustomLocaleData> {
        let messages = this.cache.get(lang);

        if (!messages) {
            const response: LocaleMessages = await (await fetch(getLocaleFilename(lang))).json();

            if (!response || typeof response !== "object") {
                throw new Error(`Invalid or empty locale data for "${lang}"`);
            }

            messages = flattenLocaleMessages(response);

            this.cache.set(lang, messages);
        }

        return messages;
    }
}
