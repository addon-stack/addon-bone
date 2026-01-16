import _ from "lodash";

import {convertLocaleKey} from "@locale/utils";

import {LocaleError} from "./LocaleValidator";

import {
    Language,
    LocaleBuilder as LocaleBuilderContract,
    LocaleCustomKeyForLanguage,
    LocaleData,
    LocaleItems,
    LocaleKeys,
    LocaleMessages,
    LocaleNestedKeysSeparator,
    LocaleStructure,
    LocaleValidator,
    LocaleValuesSeparator,
} from "@typing/locale";
import {Browser} from "@typing/browser";

export default class LocaleBuilder implements LocaleBuilderContract {
    protected data: LocaleData[] = [];
    protected items?: LocaleItems;

    protected validator?: LocaleValidator;

    constructor(
        protected readonly browser: Browser,
        protected readonly language: Language
    ) {}

    public get(): LocaleItems {
        if (this.items) {
            return this.items;
        }

        const items: LocaleItems = new Map();

        for (const data of this.data) {
            for (const [key, value] of this.convert(data).entries()) {
                items.set(key, value);
            }
        }

        /**
         We inject a locale marker into each `messages.json`.
         Chrome provides no API to query the effective i18n locale:
         browser UI language may differ from the translation actually used
         (Chrome silently falls back to default_locale).
         Reading this marker via chrome.i18n.getMessage() is the only reliable way
         to detect the language currently displayed in the extension UI.
         */
        items.set(LocaleCustomKeyForLanguage, this.language);

        return (this.items = items);
    }

    public keys(): LocaleKeys {
        return new Set(this.get().keys());
    }

    public build(): LocaleMessages {
        return this.validate()
            .get()
            .entries()
            .reduce(
                (locale, [key, value]) => ({
                    ...locale,
                    [convertLocaleKey(key)]: {message: value},
                }),
                {}
            );
    }

    public structure(): LocaleStructure {
        const substitutions = (value: string): string[] => {
            const pattern = /{{([^{}]+)}}/g;
            const substitutions: string[] = [];

            let match: RegExpExecArray | null;

            while ((match = pattern.exec(value)) !== null) {
                substitutions.push(match[1].trim());
            }

            return substitutions;
        };

        return this.get()
            .entries()
            .reduce(
                (structure, [key, value]) => ({
                    ...structure,
                    [key]: {
                        plural: value.includes(LocaleValuesSeparator),
                        substitutions: substitutions(value),
                    },
                }),
                {} as LocaleStructure
            );
    }

    public merge(data: LocaleData): this {
        this.data.push(data);
        this.items = undefined;

        return this;
    }

    public lang(): Language {
        return this.language;
    }

    public isValid(): boolean {
        try {
            this.validate();
            return true;
        } catch {
            return false;
        }
    }

    public validate(): this {
        if (!this.validator) {
            throw new LocaleError(this.browser, this.language, "Validator is not set");
        }

        this.validator.validate(this);

        return this;
    }

    public setValidator(validator: LocaleValidator): this {
        this.validator = validator;

        return this;
    }

    protected convert(data: LocaleData, prefix?: string): LocaleItems {
        const items: LocaleItems = new Map();

        for (const [key, value] of Object.entries(data)) {
            const resolvedKey = prefix ? [prefix, key].join(LocaleNestedKeysSeparator) : key;

            if (_.isString(value) || _.isNumber(value)) {
                items.set(resolvedKey, value.toString());
            } else if (_.isArray(value)) {
                items.set(
                    resolvedKey,
                    _.filter(value, v => _.isString(v) || _.isNumber(v)).join(LocaleValuesSeparator)
                );
            } else if (_.isPlainObject(value)) {
                for (const [k, v] of this.convert(value, resolvedKey).entries()) {
                    items.set(k, v);
                }
            }
        }

        return items;
    }
}
