jest.mock("@addon-core/browser", () => ({
    getI18nMessage: jest.fn(),
}));
jest.mock("#adnbn/locale", () => ({keys: ["demo.empty", "demo.title"], languages: ["en", "fr", "ru"]}));

import {getI18nMessage} from "@addon-core/browser";
import NativeLocale from "./NativeLocale";

interface Structure {
    "demo.empty": {plural: false; substitutions: []};
    "demo.title": {plural: false; substitutions: []};
}

describe("NativeLocale", () => {
    let locale: NativeLocale<Structure>;
    let warn: jest.SpyInstance;
    let error: jest.SpyInstance;

    beforeEach(() => {
        jest.mocked(getI18nMessage)
            .mockReset()
            .mockImplementation(key => (key === "locale" ? "ru" : ""));
        warn = jest.spyOn(console, "warn").mockImplementation();
        error = jest.spyOn(console, "error").mockImplementation();
        locale = new NativeLocale<Structure>();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("preserves an empty message for a known build key without warning", () => {
        expect(locale.trans("demo.empty")).toBe("");
        expect(getI18nMessage).toHaveBeenLastCalledWith("demo_empty");
        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
    });

    test("warns and returns the key when an unknown message is empty", () => {
        expect(locale.get("demo.missing" as never)).toBe("demo.missing");
        expect(warn).toHaveBeenCalledWith('Locale key "demo.missing" not found in "ru" language.');
        expect(error).not.toHaveBeenCalled();
    });

    test.each(["Translated title", "0"])("preserves the nonempty message %j without consulting build keys", value => {
        jest.mocked(getI18nMessage).mockReturnValue(value);
        const keys = jest.spyOn(locale, "keys");

        expect(locale.trans("demo.title")).toBe(value);
        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
        expect(keys).not.toHaveBeenCalled();
    });

    test("preserves nonempty messages outside the default build contract", () => {
        jest.mocked(getI18nMessage).mockReturnValue("Extra translation");

        expect(locale.get("demo.extra" as never)).toBe("Extra translation");
        expect(warn).not.toHaveBeenCalled();
    });

    test("can translate a known message even when the language marker is missing", () => {
        jest.mocked(getI18nMessage).mockImplementation(key => (key === "locale" ? "" : "Hello {{name}}"));
        const withoutMarker = new NativeLocale<Structure>();

        expect(withoutMarker.trans("demo.title")).toBe("Hello {{name}}");
        expect(withoutMarker.get("demo.title", {name: "Ada"})).toBe("Hello Ada");
    });

    test("does not treat an undefined API result as a valid empty translation", () => {
        jest.mocked(getI18nMessage).mockReturnValue(undefined);

        expect(locale.trans("demo.empty")).toBe("demo.empty");
        expect(warn).toHaveBeenCalledWith('Locale key "demo.empty" not found in "ru" language.');
    });

    test("keeps missing-key diagnostics when build keys are empty", () => {
        jest.spyOn(locale, "keys").mockReturnValue(new Set());

        expect(locale.trans("demo.empty")).toBe("demo.empty");
        expect(warn).toHaveBeenCalledWith('Locale key "demo.empty" not found in "ru" language.');
    });

    test("returns independent sets of public dot keys from the locale module", () => {
        expect([...locale.keys()]).toEqual(["demo.empty", "demo.title"]);
        locale.keys().clear();
        expect([...locale.keys()]).toEqual(["demo.empty", "demo.title"]);
    });

    test("reads available languages from the module independently of the selected native language", () => {
        expect(locale.lang()).toBe("ru");
        expect([...locale.langs()]).toEqual(["en", "fr", "ru"]);
        expect([...locale.langNames()]).toEqual([
            ["en", "English"],
            ["fr", "Français"],
            ["ru", "Русский"],
        ]);
        expect(error).not.toHaveBeenCalled();
    });
});
