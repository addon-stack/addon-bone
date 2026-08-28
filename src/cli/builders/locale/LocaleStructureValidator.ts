import _ from "lodash";

import {Language, LocaleBuilder, LocaleBuilders, LocaleContractValidator} from "@typing/locale";

export default class implements LocaleContractValidator {
    constructor(protected readonly defaultLanguage: Language) {}

    public isValid(builders: LocaleBuilders): boolean {
        try {
            this.validate(builders);

            return true;
        } catch {
            return false;
        }
    }

    public validate(builders: LocaleBuilders): this {
        const defaultBuilder = this.getDefaultBuilder(builders);

        if (!defaultBuilder) {
            return this;
        }

        const defaultStructure = defaultBuilder.structure();

        for (const [language, builder] of builders.entries()) {
            if (language === this.defaultLanguage) {
                continue;
            }

            const structure = builder.structure();

            for (const [key, expected] of Object.entries(defaultStructure)) {
                if (expected.plural && !Object.hasOwn(structure, key)) {
                    throw new Error(
                        `Locale "${language}" is missing plural key "${key}" required by default locale "${this.defaultLanguage}"`
                    );
                }
            }

            for (const [key, locale] of Object.entries(structure)) {
                const expected = defaultStructure[key];

                if (!expected) {
                    console.warn(
                        `Locale "${language}" contains unknown key "${key}" not found in default locale "${this.defaultLanguage}"`
                    );
                    continue;
                }

                if (expected.plural !== locale.plural) {
                    throw new Error(
                        `Locale "${language}" key "${key}" must be ${expected.plural ? "plural" : "non-plural"} like default locale "${this.defaultLanguage}"`
                    );
                }

                if (!_.isEqual(expected.substitutions, locale.substitutions)) {
                    throw new Error(
                        `Locale "${language}" key "${key}" substitutions [${locale.substitutions.join(", ")}] must match default locale "${this.defaultLanguage}" substitutions [${expected.substitutions.join(", ")}]`
                    );
                }
            }
        }

        return this;
    }

    public getDefaultBuilder(builders: LocaleBuilders): LocaleBuilder | undefined {
        if (builders.size === 0) {
            return undefined;
        }

        const builder = builders.get(this.defaultLanguage);

        if (!builder) {
            throw new Error(
                `Default locale "${this.defaultLanguage}" not found in available translations. Available languages: ${[...builders.keys()].join(", ")}`
            );
        }

        return builder;
    }
}
