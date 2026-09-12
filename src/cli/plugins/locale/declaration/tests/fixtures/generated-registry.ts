import {Language, NativeLocale, DynamicLocale, t, choice, key, resolve, type LocaleRegistry} from "adnbn/locale";
import {useNativeLocale} from "adnbn/locale/react";

t("app.title");
t("app.greeting", {name: "Ada"});
choice("cart.items", 2, {count: 2});
choice("cart.empty", 0);
key("app.title");
key("cart.items");
resolve("@app.title");
resolve("Plain title");
const nativeLocale = new NativeLocale();
nativeLocale.trans("app.greeting", {name: "Ada"});
nativeLocale.choice("cart.items", 2, {count: 2});
NativeLocale.getInstance().trans("app.title");
NativeLocale.getInstance().choice("cart.empty", 0);
const dynamicLocale = new DynamicLocale(false);
const messages: Readonly<Record<string, string>> = dynamicLocale.messages();
const rawTitle: string = messages.app_title;
// @ts-expect-error the messages view is read-only
dynamicLocale.messages().app_title = "Changed";
dynamicLocale.trans("app.title");
dynamicLocale.choice("cart.items", 2, {count: 2});
dynamicLocale.change(Language.French);
const synced: Promise<Language> = dynamicLocale.sync();
const unwatch: () => void = dynamicLocale.watch(lang => {});
dynamicLocale.unwatch();
useNativeLocale().t("app.greeting", {name: "Ada"});
useNativeLocale().choice("cart.items", 2, {count: 2});
const allKeys: ReadonlySet<"app.title" | "app.greeting" | "cart.items" | "cart.empty"> = nativeLocale.keys();
const knownKey: keyof LocaleRegistry = "app.title";
// @ts-expect-error no index signature widens the registry
const arbitraryKey: keyof LocaleRegistry = "extra";
// @ts-expect-error a secondary-only key must not enter the default contract
t("extra");
// @ts-expect-error substitutions remain mandatory
t("app.greeting");
// @ts-expect-error substitutions must contain every declared placeholder
t("app.greeting", {});
// @ts-expect-error unknown substitutions are rejected
t("app.greeting", {name: "Ada", extra: "bad"});
// @ts-expect-error substitution values must be strings or numbers
t("app.greeting", {name: true});
// @ts-expect-error keys without placeholders reject substitutions
t("app.title", {});
// @ts-expect-error plural keys cannot be translated as ordinary keys
t("cart.items");
// @ts-expect-error ordinary keys cannot be used as plural keys
choice("app.title", 2);
// @ts-expect-error plural substitutions remain mandatory
choice("cart.items", 2);
// @ts-expect-error plural keys without placeholders reject substitutions
choice("cart.empty", 2, {});
// @ts-expect-error marker keys share the registry
key("extra");
// @ts-expect-error native providers retain the key contract
nativeLocale.trans("extra");
// @ts-expect-error native providers retain the substitution contract
nativeLocale.trans("app.greeting");
// @ts-expect-error the singleton retains the substitution contract
NativeLocale.getInstance().choice("cart.items", 2);
// @ts-expect-error dynamic providers retain the key contract
dynamicLocale.trans("extra");
// @ts-expect-error dynamic providers retain the substitution contract
dynamicLocale.choice("cart.items", 2);
// @ts-expect-error React retains the generated key contract
useNativeLocale().t("extra");
// @ts-expect-error React retains the substitution contract
useNativeLocale().t("app.greeting");
// @ts-expect-error React retains the plural contract
useNativeLocale().choice("app.title", 2);
