jest.mock("@addon-core/browser", () => ({
    getI18nMessage: jest.fn(() => "en"),
}));

import {createElement, PropsWithChildren} from "react";
import {act, cleanup, renderHook, waitFor} from "@testing-library/react";
import {getI18nMessage} from "@addon-core/browser";
import LocaleProvider from "./LocaleProvider";
import {useLocale, type LocaleContract} from "./context";
import {Language} from "@typing/locale";

describe("React locale provider", () => {
    const languagesDescriptor = Object.getOwnPropertyDescriptor(globalThis, "__ADNBN_DEFINED_LOCALES__");
    const keysDescriptor = Object.getOwnPropertyDescriptor(globalThis, "__ADNBN_LOCALE_KEYS__");
    const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");

    beforeEach(() => {
        jest.mocked(getI18nMessage).mockReset().mockReturnValue("en");
        Object.defineProperty(globalThis, "__ADNBN_DEFINED_LOCALES__", {
            configurable: true,
            value: [Language.English, Language.French],
        });
        Object.defineProperty(globalThis, "__ADNBN_LOCALE_KEYS__", {
            configurable: true,
            value: ["demo.empty"],
        });
        Object.defineProperty(globalThis, "fetch", {
            configurable: true,
            value: jest.fn(async () => ({json: async () => ({locale: {message: "fr"}})})),
        });
    });

    afterEach(() => {
        cleanup();
        jest.restoreAllMocks();

        for (const [key, descriptor] of [
            ["__ADNBN_DEFINED_LOCALES__", languagesDescriptor],
            ["__ADNBN_LOCALE_KEYS__", keysDescriptor],
            ["fetch", fetchDescriptor],
        ] as const) {
            if (descriptor) {
                Object.defineProperty(globalThis, key, descriptor);
            } else {
                Reflect.deleteProperty(globalThis, key);
            }
        }
    });

    test("returns an empty map outside a provider", () => {
        const {result} = renderHook(() => useLocale());

        expect(result.current.langs).toEqual(new Map());
        expect(result.current).not.toHaveProperty("languageNames");
    });

    test("returns keys outside a provider, ignoring substitutions and plural counts", () => {
        const {result} = renderHook(() => useLocale());
        const locale = result.current as LocaleContract<{
            "app.title": {plural: false; substitutions: []};
            "app.greeting": {plural: false; substitutions: ["name"]};
            "cart.items": {plural: true; substitutions: ["count"]};
        }>;

        expect(locale.t("app.title")).toBe("app.title");
        expect(locale.t("app.greeting", {name: "Ada"})).toBe("app.greeting");
        expect(locale.choice("cart.items", 2, {count: 2})).toBe("cart.items");
    });

    test("preserves an empty native translation on the first render without warnings or fetching", async () => {
        jest.mocked(getI18nMessage).mockImplementation(key => (key === "locale" ? "ru" : ""));
        Object.defineProperty(globalThis, "__ADNBN_DEFINED_LOCALES__", {
            value: [Language.English, Language.Russian],
        });
        const warn = jest.spyOn(console, "warn").mockImplementation();
        const wrapper = ({children}: PropsWithChildren) =>
            createElement(LocaleProvider, {container: false, storage: "native-empty-test"}, children);
        const {result} = renderHook(
            () => {
                const locale = useLocale() as LocaleContract<{
                    "demo.empty": {plural: false; substitutions: []};
                }>;

                return {lang: locale.lang, message: locale.t("demo.empty")};
            },
            {wrapper}
        );

        expect(result.current).toEqual({lang: Language.Russian, message: ""});
        await act(async () => {});
        expect(result.current).toEqual({lang: Language.Russian, message: ""});
        expect(warn).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });

    test("keeps the available language map stable while changing the selected language", async () => {
        const wrapper = ({children}: PropsWithChildren) =>
            createElement(LocaleProvider, {container: false, storage: "locale-test"}, children);
        const {result, rerender} = renderHook(() => useLocale(), {wrapper});

        await act(async () => {});
        const langs = result.current.langs;
        expect([...langs]).toEqual([
            [Language.English, "English"],
            [Language.French, "Français"],
        ]);

        act(() => result.current.change(Language.French));
        await waitFor(() => expect(result.current.lang).toBe(Language.French));
        rerender();

        expect(result.current.langs).toBe(langs);
        expect([...result.current.langs.keys()]).toEqual([Language.English, Language.French]);
    });
});
