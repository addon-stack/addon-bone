import type {ReactNode} from "react";
import type {
    Language,
    LocaleDir,
    LocaleNonPluralKeys,
    LocalePluralKeys,
    LocaleRegistry,
    LocaleSubstitutionArgs,
    LocaleSubstitutionKeys,
} from "@typing/locale";

export type LocaleReactSubstitutionArgs<S, K extends keyof S> = string extends keyof S
    ? [substitutions?: Record<string, ReactNode>]
    : [LocaleSubstitutionKeys<S, K>] extends [never]
      ? []
      : [substitutions: Record<LocaleSubstitutionKeys<S, K>, ReactNode>];

/** Translation capabilities shared by React adapters, without language mutation or storage. */
export interface LocaleReactContract<S extends object = LocaleRegistry> {
    /** Currently selected language code. */
    readonly lang: Language;
    /** Available language codes. */
    readonly langs: ReadonlySet<Language>;
    /** Native names keyed by the available language codes. */
    readonly langNames: ReadonlyMap<Language, string>;
    readonly dir: LocaleDir;
    readonly isRtl: boolean;

    t<K extends LocaleNonPluralKeys<S>>(key: K, ...args: LocaleSubstitutionArgs<S, K>): string;
    t<K extends LocaleNonPluralKeys<S>>(key: K, ...args: LocaleReactSubstitutionArgs<S, K>): ReactNode;

    choice<K extends LocalePluralKeys<S>>(key: K, count: number, ...args: LocaleSubstitutionArgs<S, K>): string;
    choice<K extends LocalePluralKeys<S>>(key: K, count: number, ...args: LocaleReactSubstitutionArgs<S, K>): ReactNode;
}

/** React translations with an observable language selection. */
export interface LocaleReactDynamicContract<S extends object = LocaleRegistry> extends LocaleReactContract<S> {
    change(lang: Language): Promise<Language>;
}
