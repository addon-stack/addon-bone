import {createContext, useContext} from "react";

import {LocaleDir, Language, LocaleNonPluralKeys, LocaleSubstitutionArgs, LocalePluralKeys} from "@typing/locale";

import {LocaleNativeStructure} from "@locale/providers";

export interface LocaleContract<S extends object = LocaleNativeStructure> {
    lang: Language;

    langs: ReadonlyMap<Language, string>;

    dir: LocaleDir;

    isRtl: boolean;

    t<K extends LocaleNonPluralKeys<S>>(key: K, ...args: LocaleSubstitutionArgs<S, K>): string;

    choice<K extends LocalePluralKeys<S>>(key: K, count: number, ...args: LocaleSubstitutionArgs<S, K>): string;

    change(lang: Language): void;
}

export const DefaultLocale: LocaleContract = {
    lang: Language.English,
    langs: new Map(),
    isRtl: false,
    dir: LocaleDir.LeftToRight,
    t(key, ..._args): string {
        return key;
    },
    choice(key, _count, ..._args): string {
        return key;
    },
    change(_lang: Language) {},
};

export const LocaleContext = createContext<LocaleContract>(DefaultLocale);

LocaleContext.displayName = "LocaleContext";

export const useLocale = () => useContext(LocaleContext);
