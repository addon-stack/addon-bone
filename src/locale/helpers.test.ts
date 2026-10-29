import {jest} from "@jest/globals";

jest.unstable_mockModule("#adnbn/locale", () => ({
    default: {},
    lang: "en",
    keys: ["locale", "app.title", "app.greeting"],
    languages: ["en"],
}));

const {getBrowserTest} = await import("@tests/browser-harness/session");
const {resolve} = await import("./index");

describe("locale resolve", () => {
    beforeEach(() => {
        const messages: Record<string, string> = {
            locale: "en",
            app_title: "App title",
            app_greeting: "Hello {{name}}",
        };

        getBrowserTest().harness.configurable.chrome.i18n.getMessage.setImplementation(key => messages[key] ?? "");
    });

    test.each(["Plain title", "", "@"])('leaves "%s" unchanged without reading native messages', input => {
        expect(resolve(input)).toBe(input);
        expect(getBrowserTest().harness.configurable.chrome.i18n.getMessage.calls).toHaveLength(0);
    });

    test("resolves runtime markers through the native provider", () => {
        expect(resolve("@app.title")).toBe("App title");
        expect(getBrowserTest().harness.configurable.chrome.i18n.getMessage.calls.at(-1)?.args[0]).toBe("app_title");
    });

    test("keeps placeholders when resolving without substitutions", () => {
        expect(resolve("@app.greeting")).toBe("Hello {{name}}");
    });

    test("keeps the native missing-key warning and fallback", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

        expect(resolve("@missing")).toBe("missing");
        expect(warn).toHaveBeenCalledWith('Locale key "missing" not found in "en" language.');
    });
});
