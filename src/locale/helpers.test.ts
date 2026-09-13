jest.mock("@addon-core/browser", () => ({
    getI18nMessage: jest.fn((key: string) => {
        const messages: Record<string, string> = {
            locale: "en",
            app_title: "App title",
            app_greeting: "Hello {{name}}",
        };

        return messages[key] ?? "";
    }),
}));

import {getI18nMessage} from "@addon-core/browser";
import {resolve} from "./index";

jest.mock("#adnbn/locale", () => ({keys: ["locale", "app.title", "app.greeting"], languages: ["en"]}));

describe("locale resolve", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test.each(["Plain title", "", "@"])('leaves "%s" unchanged without reading native messages', input => {
        expect(resolve(input)).toBe(input);
        expect(getI18nMessage).not.toHaveBeenCalled();
    });

    test("resolves runtime markers through the native provider", () => {
        expect(resolve("@app.title")).toBe("App title");
        expect(getI18nMessage).toHaveBeenCalledWith("app_title");
    });

    test("keeps placeholders when resolving without substitutions", () => {
        expect(resolve("@app.greeting")).toBe("Hello {{name}}");
    });

    test("keeps the native missing-key warning and fallback", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation();

        expect(resolve("@missing")).toBe("missing");
        expect(warn).toHaveBeenCalledWith('Locale key "missing" not found in "en" language.');
    });
});
