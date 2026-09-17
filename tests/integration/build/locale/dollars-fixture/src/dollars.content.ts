import {defineContentScript} from "adnbn";
import {DynamicLocale, NativeLocale, type LocaleProvider, type LocaleRegistry} from "adnbn/locale";

const translate = (locale: LocaleProvider<LocaleRegistry>) => ({
    price: locale.trans("price", {value: "1.15"}),
    spaced: locale.trans("spaced", {value: "1.15"}),
    number: locale.trans("number"),
    trailing: locale.trans("trailing"),
    single: locale.trans("single"),
    double: locale.trans("double"),
    triple: locale.trans("triple"),
    named: locale.trans("named"),
    substitution: locale.trans("substitution", {value: "$1.15"}),
    plural: locale.choice("plural", 2, {value: "1.15", count: 2}),
});

export default defineContentScript({
    matches: ["http://127.0.0.1/*"],
    render: () => {
        const result = document.createElement("pre");
        result.id = "locale-dollar-results";
        result.textContent = JSON.stringify({
            native: translate(new NativeLocale()),
            dynamic: translate(new DynamicLocale(false)),
        });

        return result;
    },
});
