import type {ReactNode} from "react";
import {
    Language,
    ObservableLocale,
    type LocaleDynamicProvider,
    type LocaleRegistry,
    type LocaleSnapshot,
    type LocaleStorageDriver,
} from "adnbn/locale";
import {useLocale, useLocaleAttributes, type LocaleReactDynamicContract} from "adnbn/locale/react";

declare const storage: LocaleStorageDriver;
const locale: LocaleReactDynamicContract = useLocale(storage);
useLocaleAttributes(locale);
useLocaleAttributes(locale, null);
useLocale();
useLocale(false);
const saved: Promise<Language> = locale.change(Language.French);
const text: string = locale.t("app.greeting", {name: "Ada"});
const node: ReactNode = locale.t("app.greeting", {name: <strong>Ada</strong>});
const plural: string = locale.choice("cart.items", 2, {count: 2});
const pluralNode: ReactNode = locale.choice("cart.items", 2, {count: <span>2</span>});
const title: string = locale.t("app.title");
const emptyPlural: string = locale.choice("cart.empty", 0);

const observable = ObservableLocale.getInstance(storage);
const snapshot: LocaleSnapshot<LocaleRegistry> = observable.snapshot();
const selected: Language = snapshot.lang();
const raw: string = snapshot.get("app.greeting");
const codes: ReadonlySet<Language> = snapshot.langs();
const names: ReadonlyMap<Language, string> = snapshot.langNames();
const stop: () => void = observable.subscribe(() => {});
const synced: Promise<Language> = observable.sync();
const changed: Promise<Language> = observable.change(Language.French);
const provider: LocaleDynamicProvider<LocaleRegistry> = observable;
const current: Language = provider.lang();
const keys: ReadonlySet<keyof LocaleRegistry> = provider.keys();
const langNames: ReadonlyMap<Language, string> = provider.langNames();
const available: ReadonlySet<Language> = provider.langs();
const greeting: string = provider.trans("app.greeting", {name: "Ada"});
const items: string = provider.choice("cart.items", 2, {count: 2});
const message: string = observable.get("app.greeting");

// @ts-expect-error direct observable instances also expose a read-only set
observable.langs().add(Language.French);
// @ts-expect-error direct observable instances also expose a read-only map
observable.langNames().set(Language.French, "Changed");
// @ts-expect-error storage is a driver or false
useLocale("locale");
// @ts-expect-error invalid keys remain rejected
locale.t("unknown");
// @ts-expect-error substitutions remain required
locale.t("app.greeting");
// @ts-expect-error extra JSX substitutions are rejected
locale.t("app.greeting", {name: <span>Ada</span>, extra: "bad"});
// @ts-expect-error plural keys cannot be used as ordinary messages
locale.t("cart.items", {count: 2});
// @ts-expect-error ordinary keys cannot be pluralized
locale.choice("app.title", 2);
// @ts-expect-error plural substitutions remain required
locale.choice("cart.items", 2);
// @ts-expect-error plural selection requires a number
locale.choice("cart.items", <span>2</span>, {count: 2});
// @ts-expect-error a node translation is not a string
const attribute: string = locale.t("app.greeting", {name: <span>Ada</span>});
// @ts-expect-error change returns a Promise
const immediate: Language = locale.change(Language.French);
// @ts-expect-error snapshots are read-only
snapshot.lang = () => Language.French;
// @ts-expect-error snapshot language codes are read-only
snapshot.langs().add(Language.French);
// @ts-expect-error snapshot language names are read-only
snapshot.langNames().set(Language.French, "Changed");
// @ts-expect-error snapshot keys follow the registry
snapshot.get("unknown");
// @ts-expect-error delegated translations retain required substitutions
observable.trans("app.greeting");
// @ts-expect-error delegated translations reject extra substitutions
observable.trans("app.greeting", {name: "Ada", extra: "bad"});
// @ts-expect-error delegated translations reject JSX
observable.trans("app.greeting", {name: <strong>Ada</strong>});
// @ts-expect-error delegated translations keep plural keys separate
observable.trans("cart.items", {count: 2});
// @ts-expect-error delegated plural selection requires substitutions
observable.choice("cart.items", 2);
// @ts-expect-error delegated plural selection rejects ordinary keys
observable.choice("app.title", 2);
// @ts-expect-error delegated message lookup follows the registry
observable.get("unknown");

interface CustomStructure {
    custom: {plural: false; substitutions: ["value"]};
}
const custom = new ObservableLocale<CustomStructure>(false);
custom.snapshot().get("custom");
const customProvider: LocaleDynamicProvider<CustomStructure> = custom;
const customText: string = customProvider.trans("custom", {value: "example"});
// @ts-expect-error a custom observable retains its own structure
custom.snapshot().get("app.title");
