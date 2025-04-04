export enum Language {
    Arabic = 'ar',
    Amharic = 'am',
    Bulgarian = 'bg',
    Bengali = 'bn',
    Catalan = 'ca',
    Czech = 'cs',
    Danish = 'da',
    German = 'de',
    Greek = 'el',
    English = 'en',
    EnglishAustralia = 'en_AU',
    EnglishGreatBritain = 'en_GB',
    EnglishUSA = 'en_US',
    Spanish = 'es',
    SpanishLatinAmericaAndCaribbean = 'es_419',
    Estonian = 'et',
    Persian = 'fa',
    Finnish = 'fi',
    Filipino = 'fil',
    French = 'fr',
    Gujarati = 'gu',
    Hebrew = 'he',
    Hindi = 'hi',
    Croatian = 'hr',
    Hungarian = 'hu',
    Indonesian = 'id',
    Italian = 'it',
    Japanese = 'ja',
    Kannada = 'kn',
    Korean = 'ko',
    Lithuanian = 'lt',
    Latvian = 'lv',
    Malayalam = 'ml',
    Marathi = 'mr',
    Malay = 'ms',
    Dutch = 'nl',
    Norwegian = 'no',
    Polish = 'pl',
    PortugueseBrazil = 'pt_BR',
    PortuguesePortugal = 'pt_PT',
    Romanian = 'ro',
    Russian = 'ru',
    Slovak = 'sk',
    Slovenian = 'sl',
    Serbian = 'sr',
    Swedish = 'sv',
    Swahili = 'sw',
    Tamil = 'ta',
    Telugu = 'te',
    Thai = 'th',
    Turkish = 'tr',
    Ukrainian = 'uk',
    Vietnamese = 'vi',
    ChineseChina = 'zh_CN',
    ChineseTaiwan = 'zh_TW',
}

export const LanguageCodes: ReadonlySet<string> = new Set(Object.values(Language));

export const LocaleFileExtensions: ReadonlySet<string> = new Set(['yaml', 'yml', 'json']);

export const LocaleDirectoryName = 'locales';

export type LocaleRawData = {
    [key: string]: string | number | LocaleRawData;
};

export type LocaleFlatData = Record<string, string>;

export type LocaleFileData = {
    [key: string]: {
        message: string;
    };
};


export interface LocaleBuilder {
    lang(): Language;
    merge(data: LocaleRawData): this;
    build(): LocaleFileData;
    get(): LocaleFlatData;
    filename(): string;
    keys(separator?: string): string[];
}