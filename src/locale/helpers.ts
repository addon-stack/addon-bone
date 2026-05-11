import {LocaleNativeStructure, NativeLocale} from "@locale/providers";
import {convertLocaleMessageKey, extractLocaleKey} from "@locale/utils";
import {LocaleNonPluralKeys, LocalePluralKeys, LocaleSubstitutionArgs} from "@typing/locale";

/**
 * Translates a non-plural locale key.
 *
 * Substitutions are type-checked from the generated locale structure:
 * keys without placeholders do not accept substitutions, while keys with
 * placeholders require all declared substitution values.
 *
 * @example
 * ```ts
 * t("app.name");
 * t("app.greeting", {name: "Alice"});
 * ```
 *
 * @param key - The locale key to translate.
 * @param args
 * @returns The translated string.
 */
export const t = <K extends LocaleNonPluralKeys<LocaleNativeStructure>>(
    key: K,
    ...args: LocaleSubstitutionArgs<LocaleNativeStructure, K>
): string => {
    return NativeLocale.getInstance().trans(key, ...args);
};

/**
 * Translates a plural locale key using the provided count.
 *
 * Substitutions are type-checked from the generated locale structure:
 * keys without placeholders do not accept substitutions, while keys with
 * placeholders require all declared substitution values.
 *
 * @example
 * ```ts
 * choice("cart.items", count, {count});
 * ```
 *
 * @param key - The locale key to translate.
 * @param count - The count used to select the plural form.
 * @param args
 * @returns The translated string.
 */
export const choice = <K extends LocalePluralKeys<LocaleNativeStructure>>(
    key: K,
    count: number,
    ...args: LocaleSubstitutionArgs<LocaleNativeStructure, K>
): string => {
    return NativeLocale.getInstance().choice(key, count, ...args);
};

/**
 * Converts a locale key to a browser message reference.
 *
 * This is useful for browser-managed extension fields that expect
 * `__MSG_name__` references instead of already translated text.
 *
 * A warning is logged when the key does not exist in the generated locale keys.
 *
 * @example
 * ```ts
 * key("app.name"); // "__MSG_app_name__"
 * ```
 *
 * @param value - The locale key to convert.
 * @returns The browser message reference.
 */
export const key = (value: keyof LocaleNativeStructure & string): string => {
    const locale = NativeLocale.getInstance();

    if (!locale.keys().has(value)) {
        console.warn(`Locale key "${value}" not found in "${locale.lang()}" language.`);
    }

    return convertLocaleMessageKey(value);
};

/**
 * Resolves a string that may contain a locale marker.
 *
 * When the input contains a locale marker, the marker is extracted and translated.
 * Plain strings are returned unchanged.
 *
 * @example
 * ```ts
 * resolve("@app.name");
 * resolve("Plain title");
 * ```
 *
 * @param input - A plain string or a marked locale key string.
 * @returns The translated text when a marker is found, otherwise the original input.
 */
export const resolve = (input: string): string => {
    const localeKey = extractLocaleKey(input);

    if (localeKey) {
        return t(localeKey as LocaleNonPluralKeys<LocaleNativeStructure>);
    }

    return input;
};
