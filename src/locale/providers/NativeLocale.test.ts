jest.mock("@addon-core/browser", () => ({
    getI18nMessage: jest.fn(),
}));

import {getI18nMessage} from "@addon-core/browser";
import NativeLocale from "./NativeLocale";

interface Structure {
    "demo.empty": {plural: false; substitutions: []};
    "demo.title": {plural: false; substitutions: []};
}

describe("NativeLocale", () => {
    const keysDescriptor = Object.getOwnPropertyDescriptor(globalThis, "__ADNBN_LOCALE_KEYS__");
    let locale: NativeLocale<Structure>;
    let warn: jest.SpyInstance;
    let error: jest.SpyInstance;

    beforeEach(() => {
        Object.defineProperty(globalThis, "__ADNBN_LOCALE_KEYS__", {
            configurable: true,
            value: ["demo.empty", "demo.title"],
        });
        jest.mocked(getI18nMessage)
            .mockReset()
            .mockImplementation(key => (key === "locale" ? "ru" : ""));
        warn = jest.spyOn(console, "warn").mockImplementation();
        error = jest.spyOn(console, "error").mockImplementation();
        locale = new NativeLocale<Structure>();
    });

    afterEach(() => {
        if (keysDescriptor) {
            Object.defineProperty(globalThis, "__ADNBN_LOCALE_KEYS__", keysDescriptor);
        } else {
            Reflect.deleteProperty(globalThis, "__ADNBN_LOCALE_KEYS__");
        }
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
        Reflect.deleteProperty(globalThis, "__ADNBN_LOCALE_KEYS__");

        expect(locale.trans("demo.title")).toBe(value);
        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
    });

    test("preserves nonempty messages outside the default build contract", () => {
        jest.mocked(getI18nMessage).mockReturnValue("Extra translation");

        expect(locale.get("demo.extra" as never)).toBe("Extra translation");
        expect(warn).not.toHaveBeenCalled();
    });

    test("does not treat an undefined API result as a valid empty translation", () => {
        jest.mocked(getI18nMessage).mockReturnValue(undefined);

        expect(locale.trans("demo.empty")).toBe("demo.empty");
        expect(warn).toHaveBeenCalledWith('Locale key "demo.empty" not found in "ru" language.');
    });

    test("keeps missing-key diagnostics when build keys are unavailable", () => {
        Reflect.deleteProperty(globalThis, "__ADNBN_LOCALE_KEYS__");

        expect(locale.trans("demo.empty")).toBe("demo.empty");
        expect(warn).toHaveBeenCalledWith('Locale key "demo.empty" not found in "ru" language.');
    });
});
