import {Language, NativeLocale, DynamicLocale, type LocaleProvider} from "adnbn/locale";
import {useLocale, useNativeLocale} from "adnbn/locale/react";

const native: ReadonlyMap<Language, string> = new NativeLocale().langNames();
const dynamic: ReadonlyMap<Language, string> = new DynamicLocale().langNames();
declare const provider: LocaleProvider<{}>;
const providerNames: ReadonlyMap<Language, string> = provider.langNames();
const available: ReadonlySet<Language> = new NativeLocale().langs();
const names: ReadonlyMap<Language, string> = useNativeLocale().langNames;
const codes: ReadonlySet<Language> = useNativeLocale().langs;
const dynamicNames: ReadonlyMap<Language, string> = useLocale().langNames;
const dynamicCodes: ReadonlySet<Language> = useLocale().langs;
const title: string | undefined = names.get(Language.French);
const includes: boolean = codes.has(Language.French);
// @ts-expect-error the provider contract exposes a read-only set
provider.langs().delete(Language.French);
// @ts-expect-error the provider contract exposes a read-only map
provider.langNames().clear();
// @ts-expect-error direct native instances also expose a read-only set
new NativeLocale().langs().add(Language.French);
// @ts-expect-error direct native instances also expose a read-only map
new NativeLocale().langNames().set(Language.French, "Changed");
// @ts-expect-error direct dynamic instances also expose a read-only set
new DynamicLocale(false).langs().clear();
// @ts-expect-error direct dynamic instances also expose a read-only map
new DynamicLocale(false).langNames().set(Language.French, "Changed");
// @ts-expect-error React exposes a read-only map
useNativeLocale().langNames.set(Language.French, "Changed");
// @ts-expect-error React exposes a read-only set
useNativeLocale().langs.add(Language.French);
// @ts-expect-error the dynamic hook also exposes a read-only map
useLocale().langNames.set(Language.French, "Changed");
// @ts-expect-error the dynamic hook also exposes a read-only set
useLocale().langs.add(Language.French);
// @ts-expect-error keys are Language values, not arbitrary strings
native.get("unsupported");
