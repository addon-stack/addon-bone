import {selectPluralForm, applySubstitutions} from "@shared/locale";

import {
    Language,
    LanguageNames,
    LocaleNonPluralKeys,
    LocalePluralKeys,
    LocaleProvider,
    LocaleStructure,
    LocaleSubstitutionArgs,
    LocaleSubstitutionValue,
} from "@typing/locale";

export default abstract class AbstractLocale<S extends object = LocaleStructure> implements LocaleProvider<S> {
    public abstract lang(): Language;

    public abstract keys(): Set<keyof S>;

    public abstract languages(): Set<Language>;

    /** Returns native names for this provider's languages, preserving their order. */
    public languageNames(): Map<Language, string> {
        return new Map([...this.languages()].map(language => [language, LanguageNames[language]]));
    }

    protected abstract value(key: keyof S & string): string | undefined;

    public trans<K extends LocaleNonPluralKeys<S>>(key: K, ...args: LocaleSubstitutionArgs<S, K>): string {
        const [substitutions] = args;

        return this.get(key, substitutions);
    }

    public choice<K extends LocalePluralKeys<S>>(key: K, count: number, ...args: LocaleSubstitutionArgs<S, K>): string {
        const [substitutions] = args;
        const message = selectPluralForm(this.get(key), this.lang(), count);

        return this.substitute(message, key, substitutions);
    }

    public get<K extends keyof S & string>(key: K, substitutions?: Record<string, LocaleSubstitutionValue>): string {
        const template = this.value(key);

        if (template === undefined) {
            console.warn(`Locale key "${key}" not found in "${this.lang()}" language.`);

            return key as string;
        }

        return this.substitute(template, key, substitutions);
    }

    private substitute(message: string, key: string, substitutions?: Record<string, LocaleSubstitutionValue>): string {
        return applySubstitutions(message, substitutions, name => {
            console.warn(`Locale substitution "${name}" not found for key "${key}" in "${this.lang()}" language.`);
        }).join("");
    }
}
