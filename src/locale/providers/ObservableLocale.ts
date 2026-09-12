import DynamicLocale from "./DynamicLocale";
import CustomLocale from "./CustomLocale";

import {LocaleStorage} from "../storage";

import type {
    Language,
    LocaleDynamicProvider,
    LocaleNonPluralKeys,
    LocalePluralKeys,
    LocaleRegistry,
    LocaleSnapshot,
    LocaleStorageDriver,
    LocaleSubstitutionArgs,
    LocaleSubstitutionValue,
} from "@typing/locale";

/** Dynamic translations with shared instances and subscriptions independent of any UI framework. */
export default class ObservableLocale<T extends object = LocaleRegistry> implements LocaleDynamicProvider<T> {
    private static defaultInstance?: ObservableLocale;
    private static memoryInstance?: ObservableLocale;

    private static readonly drivers = new WeakMap<LocaleStorageDriver, ObservableLocale>();

    public static getInstance(storage?: LocaleStorageDriver | false): ObservableLocale {
        if (typeof storage === "object") {
            let instance = this.drivers.get(storage);

            if (!instance) {
                instance = new ObservableLocale(storage);
                this.drivers.set(storage, instance);
            }

            return instance;
        }

        if (storage === false) {
            return (this.memoryInstance ??= new ObservableLocale(false));
        }

        return (this.defaultInstance ??= new ObservableLocale());
    }

    private readonly locale = new DynamicLocale<T>(false);
    private readonly storage?: LocaleStorageDriver;
    private readonly listeners = new Set<() => void>();
    private readonly languages: ReadonlySet<Language>;
    private readonly languageNames: ReadonlyMap<Language, string>;
    private currentSnapshot: LocaleSnapshot<T>;
    private revision = 0;
    private writes: Promise<void> = Promise.resolve();
    private pendingWrites = 0;
    private unsubscribe?: () => void;

    constructor(storage?: LocaleStorageDriver | false) {
        this.storage = storage === false ? undefined : (storage ?? new LocaleStorage());
        this.languages = this.langs();
        this.languageNames = this.langNames();
        this.currentSnapshot = this.createSnapshot();
    }

    public lang(): Language {
        return this.locale.lang();
    }

    public langs(): ReadonlySet<Language> {
        return this.locale.langs();
    }

    public langNames(): ReadonlyMap<Language, string> {
        return this.locale.langNames();
    }

    public keys(): Set<keyof T> {
        return this.locale.keys();
    }

    public get<K extends keyof T & string>(key: K, substitutions?: Record<string, LocaleSubstitutionValue>): string {
        return this.locale.get(key, substitutions);
    }

    public trans<K extends LocaleNonPluralKeys<T>>(key: K, ...args: LocaleSubstitutionArgs<T, K>): string {
        return this.locale.trans(key, ...args);
    }

    public choice<K extends LocalePluralKeys<T>>(key: K, count: number, ...args: LocaleSubstitutionArgs<T, K>): string {
        return this.locale.choice(key, count, ...args);
    }

    public readonly snapshot = (): LocaleSnapshot<T> => this.currentSnapshot;

    public readonly subscribe = (listener: () => void): (() => void) => {
        // Each subscription owns its cleanup, even when the same callback is subscribed twice.
        const notify = () => listener();

        this.listeners.add(notify);

        try {
            this.connect();
        } catch (error) {
            this.listeners.delete(notify);
            throw error;
        }

        if (this.listeners.size === 1) {
            void this.refresh();
        }

        return () => {
            this.listeners.delete(notify);
            this.disconnect();
        };
    };

    public readonly change = async (lang: Language): Promise<Language> => {
        this.locale.select(lang);

        const storage = this.storage;

        if (!storage) {
            this.publish();
            return lang;
        }

        this.revision++;

        // Register persistence before notifying: a subscriber may select another language immediately.
        this.pendingWrites++;

        const saved = this.writes.then(() => storage.set(lang));

        this.writes = saved.catch(() => undefined);

        this.publish();

        let succeeded = false;

        try {
            await saved;
            succeeded = true;

            return lang;
        } finally {
            if (--this.pendingWrites === 0 && succeeded) {
                void this.refresh();
            }
        }
    };

    public async sync(): Promise<Language> {
        if (!this.storage) {
            throw new Error("Language is not saving in storage");
        }

        if (this.pendingWrites) {
            return this.lang();
        }

        const revision = ++this.revision;
        const lang = await this.storage.get();

        if (revision !== this.revision || this.pendingWrites) {
            return this.lang();
        }

        if (lang === undefined) {
            return this.lang();
        }

        if (!this.langs().has(lang)) {
            console.warn(`Incorrect language code in storage - "${lang}"`);

            return this.lang();
        }

        this.locale.select(lang);

        this.publish();

        return this.lang();
    }

    private connect(): void {
        if (!this.storage || this.unsubscribe) {
            return;
        }

        this.unsubscribe = this.storage.watch(() => {
            void this.refresh();
        });
    }

    private disconnect(): void {
        if (this.listeners.size) {
            return;
        }

        this.revision++;

        this.unsubscribe?.();
        this.unsubscribe = undefined;
    }

    private async refresh(): Promise<void> {
        if (!this.storage || this.pendingWrites) {
            return;
        }

        try {
            await this.sync();
        } catch (error) {
            console.error("[ObservableLocale] Cannot synchronize language:", error);
        }
    }

    private createSnapshot(): LocaleSnapshot<T> {
        const lang = this.lang();
        const langs = this.languages;
        const langNames = this.languageNames;

        const reader = new CustomLocale<T>(lang, this.locale.messages());

        return Object.freeze({
            lang: () => lang,
            langs: () => langs,
            langNames: () => langNames,
            get: reader.get.bind(reader),
        });
    }

    private publish(): void {
        if (this.currentSnapshot.lang() === this.lang()) {
            return;
        }

        this.currentSnapshot = this.createSnapshot();

        for (const listener of [...this.listeners]) {
            try {
                listener();
            } catch (error) {
                console.error("[ObservableLocale] Language subscriber failed:", error);
            }
        }
    }
}
