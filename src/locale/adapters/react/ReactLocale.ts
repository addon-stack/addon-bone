import {createElement, Fragment, type ReactNode} from "react";

import {selectPluralForm, applySubstitutions, getLocaleDir, isLocaleRtl} from "@shared/locale";

import type {
    Language,
    LocaleDir,
    LocaleNonPluralKeys,
    LocalePluralKeys,
    LocaleRegistry,
    LocaleSubstitutionArgs,
    LocaleSnapshot,
} from "@typing/locale";

import type {LocaleReactContract, LocaleReactSubstitutionArgs} from "./types";

/** Adapts an existing message provider to React without owning storage or language changes. */
export default class ReactLocale<S extends object = LocaleRegistry> implements LocaleReactContract<S> {
    public readonly lang: Language;
    public readonly langs: ReadonlySet<Language>;
    public readonly langNames: ReadonlyMap<Language, string>;
    public readonly dir: LocaleDir;
    public readonly isRtl: boolean;

    constructor(private readonly locale: LocaleSnapshot<S>) {
        this.lang = locale.lang();
        this.langs = locale.langs();
        this.langNames = locale.langNames();
        this.dir = getLocaleDir(this.lang);
        this.isRtl = isLocaleRtl(this.lang);

        this.t = this.t.bind(this);
        this.choice = this.choice.bind(this);
    }

    public t<K extends LocaleNonPluralKeys<S>>(key: K, ...args: LocaleSubstitutionArgs<S, K>): string;
    public t<K extends LocaleNonPluralKeys<S>>(key: K, ...args: LocaleReactSubstitutionArgs<S, K>): ReactNode;
    public t(key: LocaleNonPluralKeys<S>, substitutions?: Record<string, ReactNode>): ReactNode {
        return this.render(key, substitutions);
    }

    public choice<K extends LocalePluralKeys<S>>(key: K, count: number, ...args: LocaleSubstitutionArgs<S, K>): string;
    public choice<K extends LocalePluralKeys<S>>(
        key: K,
        count: number,
        ...args: LocaleReactSubstitutionArgs<S, K>
    ): ReactNode;
    public choice(key: LocalePluralKeys<S>, count: number, substitutions?: Record<string, ReactNode>): ReactNode {
        return this.render(key, substitutions, count);
    }

    private render(key: keyof S & string, substitutions?: Record<string, ReactNode>, count?: number): ReactNode {
        const message = this.locale.get(key);

        const template = count === undefined ? message : selectPluralForm(message, this.lang, count);

        const parts = applySubstitutions(template, substitutions, name => {
            console.warn(`Locale substitution "${name}" not found for key "${key}" in "${this.lang}" language.`);
        });

        if (parts.every(part => typeof part === "string" || typeof part === "number")) {
            return parts.join("");
        }

        return parts.map((part, index) => createElement(Fragment, {key: index}, part));
    }
}
