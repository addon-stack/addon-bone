import {NativeLocale, DynamicLocale} from "adnbn/locale";
import type {LocaleReactContract} from "adnbn/locale/react";

interface CustomStructure {
    custom: {plural: false; substitutions: ["value"]};
    total: {plural: true; substitutions: []};
}

new NativeLocale<CustomStructure>().trans("custom", {value: "Custom"});
new DynamicLocale<CustomStructure>(false).choice("total", 2);
declare const customLocale: LocaleReactContract<CustomStructure>;
customLocale.t("custom", {value: 1});
// @ts-expect-error explicit structures keep their own key contract
new NativeLocale<CustomStructure>().trans("app.title");
// @ts-expect-error explicit structures still require substitutions
new DynamicLocale<CustomStructure>(false).trans("custom");
// @ts-expect-error custom React contracts also keep plural keys separate
customLocale.t("total");
