jest.mock("@addon-core/browser", () => ({
    getI18nMessage: jest.fn(() => "en"),
}));

import DynamicLocale from "./DynamicLocale";
import CustomLocale, {CustomLocaleData} from "./CustomLocale";

import {Language} from "@typing/locale";

interface Structure {
    empty: {plural: false; substitutions: []};
}

class TestDynamicLocale extends DynamicLocale<Structure> {
    public setLocale(lang: Language, data: CustomLocaleData): this {
        this.locale = new CustomLocale<Structure>(lang, data);

        return this;
    }
}

describe("DynamicLocale", () => {
    test("does not fall back to native locale when dynamic value is empty", () => {
        const locale = new TestDynamicLocale(false).setLocale(Language.French, {
            empty: "",
        });

        expect(locale.trans("empty")).toBe("");
    });
});
