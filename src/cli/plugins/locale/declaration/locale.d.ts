import {
    Language,
    LocaleDir,
    type LocaleNonPluralKeys,
    type LocalePluralKeys,
    type LocaleProvider,
    type LocaleDynamicProvider,
    type LocaleSubstitutionArgs,
} from ":package/locale";

declare module ":package/locale" {
    // prettier-ignore
    export interface GeneratedNativeStructure {}

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
     */
    export function t<K extends LocaleNonPluralKeys<GeneratedNativeStructure>>(
        key: K,
        ...args: LocaleSubstitutionArgs<GeneratedNativeStructure, K>
    ): string;

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
     */
    export function choice<K extends LocalePluralKeys<GeneratedNativeStructure>>(
        key: K,
        count: number,
        ...args: LocaleSubstitutionArgs<GeneratedNativeStructure, K>
    ): string;

    /**
     * Converts a locale key to a browser message reference.
     *
     * This is useful for browser-managed extension fields that expect
     * `__MSG_name__` references instead of already translated text.
     *
     * @example
     * ```ts
     * key("app.name"); // "__MSG_app_name__"
     * ```
     */
    export function key(value: keyof GeneratedNativeStructure & string): string;

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
     */
    export function resolve(input: string): string;

    export declare class NativeLocale implements LocaleProvider<GeneratedNativeStructure> {
        lang(): Language;

        languages(): Set<Language>;

        keys(): ReadonlySet<keyof GeneratedNativeStructure>;

        // non-plural keys
        trans<K extends LocaleNonPluralKeys<GeneratedNativeStructure>>(
            key: K,
            ...args: LocaleSubstitutionArgs<GeneratedNativeStructure, K>
        ): string;

        // plural keys
        choice<K extends LocalePluralKeys<GeneratedNativeStructure>>(
            key: K,
            count: number,
            ...args: LocaleSubstitutionArgs<GeneratedNativeStructure, K>
        ): string;
    }

    export declare class DynamicLocale extends NativeLocale implements LocaleDynamicProvider<GeneratedNativeStructure> {
        change(lang: Language): Promise<Language>;
    }
}

declare module ":package/locale/react" {
    import type {GeneratedNativeStructure} from ":package/locale";

    export interface LocaleContract {
        lang: Language;

        dir: LocaleDir;

        isRtl: boolean;

        t<K extends LocaleNonPluralKeys<GeneratedNativeStructure>>(
            key: K,
            ...args: LocaleSubstitutionArgs<GeneratedNativeStructure, K>
        ): string;

        choice<K extends LocalePluralKeys<GeneratedNativeStructure>>(
            key: K,
            count: number,
            ...args: LocaleSubstitutionArgs<GeneratedNativeStructure, K>
        ): string;

        change(lang: Language): void;
    }

    export function useLocale(): LocaleContract;
}
