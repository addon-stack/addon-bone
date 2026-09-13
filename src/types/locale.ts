import {Language} from "@typing/language";

export {Language};

export const RtlLanguages: ReadonlySet<Language> = new Set([Language.Arabic, Language.Persian, Language.Hebrew]);

export const LocaleNestedKeysSeparator = ".";

export const LocaleKeysSeparator = "_";

export const LocaleValuesSeparator = "|";

export const LocaleCustomKeyForLanguage = "locale";

export const LocaleKeyMarker = "@";

export const LanguageCodes: ReadonlySet<string> = new Set(Object.values(Language));

/** Native language names, independent of the selected UI language. */
export const LanguageNames: Readonly<Record<Language, string>> = Object.freeze({
    [Language.Arabic]: "العربية",
    [Language.Amharic]: "አማርኛ",
    [Language.Bulgarian]: "Български",
    [Language.Bengali]: "বাংলা",
    [Language.Catalan]: "Català",
    [Language.Czech]: "Čeština",
    [Language.Danish]: "Dansk",
    [Language.German]: "Deutsch",
    [Language.Greek]: "Ελληνικά",
    [Language.English]: "English",
    [Language.EnglishAustralia]: "English (Australia)",
    [Language.EnglishGreatBritain]: "English (United Kingdom)",
    [Language.EnglishUSA]: "English (United States)",
    [Language.Spanish]: "Español",
    [Language.SpanishLatinAmericaAndCaribbean]: "Español (Latinoamérica y el Caribe)",
    [Language.Estonian]: "Eesti",
    [Language.Persian]: "فارسی",
    [Language.Finnish]: "Suomi",
    [Language.Filipino]: "Filipino",
    [Language.French]: "Français",
    [Language.Gujarati]: "ગુજરાતી",
    [Language.Hebrew]: "עברית",
    [Language.Hindi]: "हिन्दी",
    [Language.Croatian]: "Hrvatski",
    [Language.Hungarian]: "Magyar",
    [Language.Indonesian]: "Bahasa Indonesia",
    [Language.Italian]: "Italiano",
    [Language.Japanese]: "日本語",
    [Language.Kannada]: "ಕನ್ನಡ",
    [Language.Korean]: "한국어",
    [Language.Lithuanian]: "Lietuvių",
    [Language.Latvian]: "Latviešu",
    [Language.Malayalam]: "മലയാളം",
    [Language.Marathi]: "मराठी",
    [Language.Malay]: "Bahasa Melayu",
    [Language.Dutch]: "Nederlands",
    [Language.Norwegian]: "Norsk",
    [Language.Polish]: "Polski",
    [Language.PortugueseBrazil]: "Português (Brasil)",
    [Language.PortuguesePortugal]: "Português (Portugal)",
    [Language.Romanian]: "Română",
    [Language.Russian]: "Русский",
    [Language.Slovak]: "Slovenčina",
    [Language.Slovenian]: "Slovenščina",
    [Language.Serbian]: "Српски",
    [Language.Swedish]: "Svenska",
    [Language.Swahili]: "Kiswahili",
    [Language.Tamil]: "தமிழ்",
    [Language.Telugu]: "తెలుగు",
    [Language.Thai]: "ไทย",
    [Language.Turkish]: "Türkçe",
    [Language.Ukrainian]: "Українська",
    [Language.Vietnamese]: "Tiếng Việt",
    [Language.ChineseChina]: "中文（简体）",
    [Language.ChineseTaiwan]: "中文（繁體）",
});

export const LocaleFileExtensions: ReadonlySet<string> = new Set(["yaml", "yml", "json"]);

export enum LocaleDir {
    RightToLeft = "rtl",
    LeftToRight = "ltr",
}

export type LocaleValue = string | number | Array<string | number>;

export type LocaleData = {
    [key: string]: LocaleValue | LocaleData;
};

export type LocaleItems = Map<string, string>;

export type LocaleKeys = ReadonlySet<string>;

export type LocaleMessages = {
    [key: string]: {
        message: string;
    };
};

export interface LocaleBuilder {
    lang(): Language;

    merge(data: LocaleData): this;

    build(): LocaleMessages;

    get(): LocaleItems;

    keys(): LocaleKeys;

    structure(): LocaleStructure;

    isValid(): boolean;

    validate(): this;
}

export type LocaleBuilders = Map<Language, LocaleBuilder>;

/** Completed messages keyed by language and browser-compatible message key. */
export type LocaleCatalogue = Partial<Record<Language, Record<string, string>>>;

export interface LocaleValidator {
    isValid(locale: LocaleBuilder): boolean;

    validate(locale: LocaleBuilder): this;
}

export interface LocaleContractValidator {
    isValid(builders: LocaleBuilders): boolean;

    validate(builders: LocaleBuilders): this;
}

export interface LocaleFutures {
    plural: boolean;
    substitutions: readonly string[];
}

export interface LocaleStructure {
    [key: string]: LocaleFutures;
}

/**
 * Empty because translation keys and their plural/substitution contracts belong to the consuming application.
 * Generated `.adnbn/locale.d.ts` declarations populate it by augmenting `adnbn/locale`.
 */
export interface LocaleRegistry {}

export type LocaleNonPluralKeys<T> = {
    [K in keyof T]: T[K] extends {plural: false} ? K : never;
}[keyof T] &
    string;

export type LocalePluralKeys<T> = {
    [K in keyof T]: T[K] extends {plural: true} ? K : never;
}[keyof T] &
    string;

export type LocaleSubstitutionValue = string | number;

export type LocaleSubstitutionKeys<T, K extends keyof T> = T[K] extends {substitutions: readonly (infer U)[]}
    ? U & string
    : never;

export type LocaleSubstitutionsFor<T, K extends keyof T> = [LocaleSubstitutionKeys<T, K>] extends [never]
    ? never
    : Record<LocaleSubstitutionKeys<T, K>, LocaleSubstitutionValue>;

export type LocaleSubstitutionArgs<T, K extends keyof T> = string extends keyof T
    ? [substitutions?: Record<string, LocaleSubstitutionValue>]
    : [LocaleSubstitutionKeys<T, K>] extends [never]
      ? []
      : [substitutions: LocaleSubstitutionsFor<T, K>];

export interface LocaleProvider<S> {
    /** Currently selected language code. */
    lang(): Language;

    /** Available language codes. */
    langs(): ReadonlySet<Language>;

    /** Native names keyed by the available language codes. */
    langNames(): ReadonlyMap<Language, string>;

    keys(): ReadonlySet<keyof S>;

    // non-plural keys
    trans<K extends LocaleNonPluralKeys<S>>(key: K, ...args: LocaleSubstitutionArgs<S, K>): string;

    // plural keys
    choice<K extends LocalePluralKeys<S>>(key: K, count: number, ...args: LocaleSubstitutionArgs<S, K>): string;
}

export interface LocaleDynamicProvider<S> extends LocaleProvider<S> {
    change(lang: Language): Promise<Language>;
}

/** Read-only message access for one selected language. */
export interface LocaleSnapshot<S> {
    readonly lang: () => Language;
    readonly langs: () => ReadonlySet<Language>;
    readonly langNames: () => ReadonlyMap<Language, string>;
    readonly get: <K extends keyof S & string>(key: K) => string;
}

/** Persists one language selection independently of the application's translation catalogue. */
export interface LocaleStorageDriver {
    /** No saved selection leaves the provider's current language unchanged. */
    get(): Promise<Language | undefined>;

    set(lang: Language): Promise<void>;

    /** Observes valid selections, including own writes; does not emit an initial value or deletions. */
    watch(handler: (lang: Language) => void): () => void;
}
