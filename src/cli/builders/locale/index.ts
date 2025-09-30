import LocaleBuilder from "./LocaleBuilder";
import LocaleValidator from "./LocaleValidator";
import OperaLocaleValidator from "./OperaLocaleValidator";
import FirefoxLocaleValidator from "./FirefoxLocaleValidator";

import {extractLocaleKey} from "@locale/utils";

import {Language, LocaleBuilder as LocaleBuilderContract} from "@typing/locale";
import {ReadonlyConfig} from "@typing/config";
import {Browser} from "@typing/browser";

export {LocaleBuilder, LocaleValidator, OperaLocaleValidator, FirefoxLocaleValidator};

export default (language: Language, config: ReadonlyConfig): LocaleBuilderContract => {
    const {browser, name, shortName, description, lang} = config;

    let Validator = LocaleValidator;

    if (browser === Browser.Opera && lang !== language) {
        Validator = OperaLocaleValidator;
    }

    if (browser === Browser.Firefox && lang !== language) {
        Validator = FirefoxLocaleValidator;
    }

    const validator = new Validator(browser, language)
        .setNameKey(extractLocaleKey(name))
        .setShortNameKey(extractLocaleKey(shortName))
        .setDescriptionKey(extractLocaleKey(description));

    return new LocaleBuilder(browser, language).setValidator(validator);
};
