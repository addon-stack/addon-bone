import type {ReactNode} from "react";
import {Language, LocaleDir, NativeLocale} from "adnbn/locale";
import {useLocaleAttributes, useNativeLocale, type LocaleReactContract} from "adnbn/locale/react";

const locale: LocaleReactContract = useNativeLocale();
const attributes: void = useLocaleAttributes(locale);
useLocaleAttributes(locale, undefined);
useLocaleAttributes(locale, "#extension-root");
useLocaleAttributes(locale, document.documentElement);
useLocaleAttributes(locale, null);
useLocaleAttributes({lang: Language.English, dir: LocaleDir.LeftToRight});

// @ts-expect-error a locale is required
useLocaleAttributes();
// @ts-expect-error only null disables the target
useLocaleAttributes(locale, false);
// @ts-expect-error language and direction are both required
useLocaleAttributes({lang: Language.English});

const language: Language = locale.lang;
const codes: ReadonlySet<Language> = locale.langs;
const names: ReadonlyMap<Language, string> = locale.langNames;
const direction: LocaleDir = locale.dir;
const rtl: boolean = locale.isRtl;

const title: string = locale.t("app.title");
const text: string = locale.t("app.greeting", {name: "Ada"});
const numeric: string = locale.t("app.greeting", {name: 42});
const greeting: ReactNode = locale.t("app.greeting", {name: <strong>Ada</strong>});
const hidden: ReactNode = locale.t("app.greeting", {name: null});
const optionalNode: ReactNode = locale.t("app.greeting", {name: undefined});
const array: ReactNode = locale.t("app.greeting", {name: ["Ada", <span key="suffix">!</span>]});
const pluralText: string = locale.choice("cart.items", 2, {count: 2});
const pluralNode: ReactNode = locale.choice("cart.items", 2, {count: <span>many</span>});
const pluralEmpty: string = locale.choice("cart.empty", 0);

// @ts-expect-error the native hook does not expose language changes
locale.change(Language.French);
// @ts-expect-error the native hook does not accept storage options
useNativeLocale(false);
// @ts-expect-error unknown keys are rejected
locale.t("app.unknown");
// @ts-expect-error substitutions remain required
locale.t("app.greeting");
// @ts-expect-error a required placeholder cannot be omitted
locale.t("app.greeting", {});
// @ts-expect-error JSX does not allow extra placeholder names
locale.t("app.greeting", {name: <span>Ada</span>, extra: <span />});
// @ts-expect-error plain objects are not React nodes
locale.t("app.greeting", {name: {text: "Ada"}});
// @ts-expect-error keys without placeholders reject substitutions
locale.t("app.title", {});
// @ts-expect-error plural keys are excluded from t
locale.t("cart.items", {count: <span>2</span>});
// @ts-expect-error ordinary keys are excluded from choice
locale.choice("app.title", 2);
// @ts-expect-error plural substitutions remain required
locale.choice("cart.items", 2);
// @ts-expect-error unknown plural substitutions are rejected
locale.choice("cart.items", 2, {count: <span>2</span>, extra: 1});
// @ts-expect-error plural keys without placeholders reject substitutions
locale.choice("cart.empty", 2, {});
// @ts-expect-error plural selection always needs a numeric count
locale.choice("cart.items", <span>2</span>, {count: 2});
// @ts-expect-error JSX translations cannot be assigned to string-only attributes
const stringGreeting: string = locale.t("app.greeting", {name: <span>Ada</span>});
// @ts-expect-error JSX plural translations are not guaranteed to return strings
const stringPlural: string = locale.choice("cart.items", 2, {count: <span>2</span>});
// @ts-expect-error React substitutions do not extend the core provider contract
NativeLocale.getInstance().trans("app.greeting", {name: <span>Ada</span>});

interface CustomStructure {
    custom: {plural: false; substitutions: ["value"]};
}
declare const custom: LocaleReactContract<CustomStructure>;
useLocaleAttributes(custom);
custom.t("custom", {value: <span />});
// @ts-expect-error custom contracts retain their own keys
custom.t("app.title");
