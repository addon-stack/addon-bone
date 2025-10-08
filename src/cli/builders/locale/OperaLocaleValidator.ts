import {Language, LocaleValidator as LocaleValidatorContract} from "@typing/locale";
import {Browser} from "@typing/browser";

import LocaleValidator from "./LocaleValidator";

export default class extends LocaleValidator implements LocaleValidatorContract {
    protected get nameLimit(): number {
        return 75;
    }

    constructor(browser: Browser, language: Language) {
        super(browser, language);
    }
}
