import {DynamicLocale, Language, LocaleStorage, type LocaleRegistry, type LocaleStorageDriver} from "adnbn/locale";

export const checkStorageContract = (storage: LocaleStorageDriver): void => {
    const builtin: LocaleStorageDriver = new LocaleStorage();
    new DynamicLocale();
    new DynamicLocale(builtin);
    new DynamicLocale(storage);
    new DynamicLocale(false);
    const read: Promise<Language | undefined> = storage.get();
    const write: Promise<void> = storage.set(Language.French);
    const stop: () => void = storage.watch(lang => {
        const selected: Language = lang;
    });
    // @ts-expect-error persisting an absent language is not part of the driver contract
    storage.set(undefined);
};

export const checkContract = (locale: DynamicLocale): void => {
    const changed: Promise<Language> = locale.change(Language.French);
    const synced: Promise<Language> = locale.sync();
    const stop: () => void = locale.watch(language => {
        const selected: Language = language;
    });
    locale.unwatch();
    const translated: string = locale.trans("welcome", {name: "Ada"});
    const plural: string = locale.choice("items", 2, {count: 2});
    const keys: ReadonlySet<"locale" | "greeting" | "app.title" | "welcome" | "items" | "fallback" | "empty"> =
        locale.keys();
    const registryKeys: ReadonlySet<keyof LocaleRegistry> = keys;
    // @ts-expect-error substitutions remain required
    locale.trans("welcome");
    // @ts-expect-error plural keys are not ordinary messages
    locale.trans("items", {count: 2});
    // @ts-expect-error ordinary messages cannot use choice
    locale.choice("greeting", 2);
    // @ts-expect-error unknown substitution names are rejected
    locale.trans("welcome", {name: "Ada", extra: "value"});
};
