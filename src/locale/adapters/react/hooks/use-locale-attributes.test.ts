jest.mock("@addon-core/browser", () => ({getI18nMessage: jest.fn(() => "en")}));
jest.mock("#adnbn/locale", () => require("./tests/fixtures/dynamic-locale"));

import {createElement, StrictMode} from "react";
import {renderToString} from "react-dom/server";
import {act, cleanup, renderHook} from "@testing-library/react";
import {useLocale, useLocaleAttributes, useNativeLocale, type LocaleReactContract} from "../index";
import {MemoryLocaleStorage} from "@locale/tests/fixtures";
import {Language, LocaleDir} from "@typing/locale";

const english: Pick<LocaleReactContract, "lang" | "dir"> = {
    lang: Language.English,
    dir: LocaleDir.LeftToRight,
};
const arabic: Pick<LocaleReactContract, "lang" | "dir"> = {
    lang: Language.Arabic,
    dir: LocaleDir.RightToLeft,
};

afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("lang");
    document.documentElement.removeAttribute("dir");
    document.body.replaceChildren();
    jest.restoreAllMocks();
});

test("defaults to html and restores existing and absent attributes in StrictMode", () => {
    const element = document.documentElement;
    element.setAttribute("lang", "de");
    const hook = renderHook(() => useLocaleAttributes(english), {wrapper: StrictMode});

    expect(element.getAttribute("lang")).toBe("en");
    expect(element.getAttribute("dir")).toBe("ltr");

    hook.unmount();
    expect(element.getAttribute("lang")).toBe("de");
    expect(element.hasAttribute("dir")).toBe(false);
});

test("updates language and direction while retaining the original attributes for cleanup", () => {
    const element = document.createElement("section");
    element.setAttribute("lang", "");
    element.setAttribute("dir", "auto");
    const hook = renderHook(({locale}) => useLocaleAttributes(locale, element), {
        initialProps: {locale: english},
    });

    hook.rerender({locale: arabic});
    expect(element.getAttribute("lang")).toBe("ar");
    expect(element.getAttribute("dir")).toBe("rtl");

    hook.rerender({locale: {...arabic, lang: Language.Hebrew}});
    expect(element.getAttribute("lang")).toBe("he");
    hook.rerender({locale: {...arabic, lang: Language.Hebrew, dir: LocaleDir.LeftToRight}});
    expect(element.getAttribute("dir")).toBe("ltr");

    hook.unmount();
    expect(element.getAttribute("lang")).toBe("");
    expect(element.getAttribute("dir")).toBe("auto");
});

test("selects only the first match and restores it when switching to a direct element", () => {
    const first = document.createElement("section");
    const second = document.createElement("section");
    first.className = second.className = "localized";
    first.setAttribute("lang", "de");
    document.body.append(first, second);
    const hook = renderHook<void, {target: string | Element}>(({target}) => useLocaleAttributes(english, target), {
        initialProps: {target: ".localized"},
    });

    expect(first.getAttribute("lang")).toBe("en");
    expect(first.getAttribute("dir")).toBe("ltr");
    expect(second.hasAttribute("lang")).toBe(false);
    expect(second.hasAttribute("dir")).toBe(false);

    hook.rerender({target: second});
    expect(first.getAttribute("lang")).toBe("de");
    expect(first.hasAttribute("dir")).toBe(false);
    expect(second.getAttribute("lang")).toBe("en");
    expect(second.getAttribute("dir")).toBe("ltr");

    hook.unmount();
    expect(second.hasAttribute("lang")).toBe(false);
    expect(second.hasAttribute("dir")).toBe(false);
});

test("null disables application and undefined enables the default target again", () => {
    const element = document.documentElement;
    element.setAttribute("lang", "de");
    const hook = renderHook<void, {target: string | null | undefined}>(
        ({target}) => useLocaleAttributes(english, target),
        {
            initialProps: {target: null},
        }
    );

    expect(element.getAttribute("lang")).toBe("de");
    expect(element.hasAttribute("dir")).toBe(false);
    hook.rerender({target: undefined});
    expect(element.getAttribute("lang")).toBe("en");
    expect(element.getAttribute("dir")).toBe("ltr");

    hook.rerender({target: null});
    expect(element.getAttribute("lang")).toBe("de");
    expect(element.hasAttribute("dir")).toBe(false);
    hook.rerender({target: undefined});
    expect(element.getAttribute("lang")).toBe("en");
});

test("skips an absent target without observing elements added later", () => {
    const hook = renderHook(({locale}) => useLocaleAttributes(locale, "#late-target"), {
        initialProps: {locale: english},
    });
    const element = document.createElement("section");
    element.id = "late-target";
    document.body.append(element);

    expect(element.hasAttribute("lang")).toBe(false);
    hook.rerender({locale: arabic});
    expect(element.getAttribute("lang")).toBe("ar");
    expect(element.getAttribute("dir")).toBe("rtl");
});

test.each(["lang", "dir"])("preserves an external change to %s and restores the other attribute", attribute => {
    const element = document.createElement("section");
    element.setAttribute("lang", "de");
    element.setAttribute("dir", "auto");
    const hook = renderHook(() => useLocaleAttributes(english, element));

    if (attribute === "lang") element.setAttribute("lang", "fr");
    else element.removeAttribute("dir");

    hook.unmount();
    expect(element.getAttribute("lang")).toBe(attribute === "lang" ? "fr" : "de");
    expect(element.getAttribute("dir")).toBe(attribute === "dir" ? null : "auto");
});

test("does not reapply attributes when only the locale object identity changes", () => {
    const element = document.createElement("section");
    const hook = renderHook(({locale}) => useLocaleAttributes(locale, element), {
        initialProps: {locale: english},
    });
    element.setAttribute("lang", "de");
    const write = jest.spyOn(element, "setAttribute");

    hook.rerender({locale: {...english}});
    expect(write).not.toHaveBeenCalled();
    expect(element.getAttribute("lang")).toBe("de");
});

test("does not modify the DOM during server rendering", () => {
    const element = document.documentElement;
    element.setAttribute("lang", "de");
    function App() {
        useLocaleAttributes(english);
        return null;
    }

    expect(renderToString(createElement(App))).toBe("");
    expect(element.getAttribute("lang")).toBe("de");
    expect(element.hasAttribute("dir")).toBe(false);
});

test("accepts the native hook's locale", () => {
    const hook = renderHook(() => {
        const locale = useNativeLocale();
        useLocaleAttributes(locale);
        return locale;
    });

    expect(document.documentElement.getAttribute("lang")).toBe(hook.result.current.lang);
    expect(document.documentElement.getAttribute("dir")).toBe(hook.result.current.dir);
});

test("follows dynamic selections and external storage changes through the supplied hook", async () => {
    const storage = new MemoryLocaleStorage();
    const element = document.createElement("section");
    const hook = renderHook(() => {
        const locale = useLocale(storage);
        useLocaleAttributes(locale, element);
        return locale;
    });

    expect(element.getAttribute("lang")).toBe("en");
    expect(storage.listenerCount).toBe(1);
    await act(async () => {
        await hook.result.current.change(Language.Arabic);
    });
    expect(element.getAttribute("lang")).toBe("ar");
    expect(element.getAttribute("dir")).toBe("rtl");

    await act(async () => {
        await storage.set(Language.French);
    });
    expect(element.getAttribute("lang")).toBe("fr");
    expect(element.getAttribute("dir")).toBe("ltr");

    hook.unmount();
    expect(element.hasAttribute("lang")).toBe(false);
    expect(element.hasAttribute("dir")).toBe(false);
    expect(storage.listenerCount).toBe(0);
});
