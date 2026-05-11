import {convertLocaleKey} from "../utils";

import AbstractLocale from "./AbstractLocale";

import {Language, LocaleStructure} from "@typing/locale";

export type CustomLocaleData = Record<string, string>;

export default class<T extends object = LocaleStructure> extends AbstractLocale<T> {
    constructor(
        protected language: Language = Language.English,
        protected data: CustomLocaleData = {}
    ) {
        super();
    }

    public setLang(lang: Language): this {
        this.language = lang;

        return this;
    }

    public setData(data: CustomLocaleData): this {
        this.data = data;

        return this;
    }

    public lang(): Language {
        return this.language;
    }

    public keys(): Set<keyof T> {
        return new Set(Object.keys(this.data)) as Set<keyof T>;
    }

    public languages(): Set<Language> {
        return new Set([this.lang()]);
    }

    protected value(key: string): string | undefined {
        const value = this.data[convertLocaleKey(key)];

        if (value === undefined) {
            return undefined;
        }

        return value;
    }
}
