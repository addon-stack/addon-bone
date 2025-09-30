import LocaleBuilder from "./LocaleBuilder";
import LocaleValidator from "./LocaleValidator";
import OperaLocaleValidator from "./OperaLocaleValidator";

import {extractLocaleKey} from "@locale/utils";

import {Language, LocaleBuilder as LocaleBuilderContract} from "@typing/locale";
import {ReadonlyConfig} from "@typing/config";
import {Browser} from "@typing/browser";

export {LocaleBuilder, LocaleValidator};

export default (language: Language, config: ReadonlyConfig): LocaleBuilderContract => {
    const {browser, name, shortName, description, lang} = config;

    let Validator = LocaleValidator;

    if (browser === Browser.Opera && lang !== language) {
        Validator = OperaLocaleValidator;
    }

    const validator = new Validator(browser, language)
        .setNameKey(extractLocaleKey(name))
        .setShortNameKey(extractLocaleKey(shortName))
        .setDescriptionKey(extractLocaleKey(description));

    return new LocaleBuilder(browser, language).setValidator(validator);
};
