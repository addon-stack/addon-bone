import {NativeLocale, DynamicLocale, t, choice, key, resolve, type LocaleRegistry} from "adnbn/locale";
import {useLocale, useNativeLocale} from "adnbn/locale/react";

const emptyKeys: ReadonlySet<never> = new NativeLocale().keys();
const emptyDynamicKeys: ReadonlySet<never> = new DynamicLocale(false).keys();
const plain: string = resolve("Plain title");
// @ts-expect-error the dynamic React hook shares the empty registry
useLocale(false).t("app.title");
declare const runtimeMarker: string;
resolve(runtimeMarker);
// @ts-expect-error an empty registry has no keys
const missing: keyof LocaleRegistry = "app.title";
// @ts-expect-error no generated non-plural keys
t("app.title");
// @ts-expect-error no generated plural keys
choice("cart.items", 2);
// @ts-expect-error marker keys are also restricted by the registry
key("app.title");
// @ts-expect-error native providers share the empty registry
new NativeLocale().trans("app.title");
// @ts-expect-error the singleton shares the empty registry
NativeLocale.getInstance().trans("app.title");
// @ts-expect-error dynamic providers share the empty registry
new DynamicLocale(false).choice("cart.items", 2);
// @ts-expect-error the native React hook shares the empty registry
useNativeLocale().t("app.title");
// @ts-expect-error an empty registry has no plural keys
useNativeLocale().choice("cart.items", 2, {count: 2});
