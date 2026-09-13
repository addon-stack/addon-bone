jest.mock("@addon-core/browser", () => ({
    getI18nMessage: jest.fn((key: string) => (key === "locale" ? "en" : "Native {{name}}")),
}));
jest.mock("#adnbn/locale", () => require("./tests/fixtures/dynamic-locale"));

import {createElement, StrictMode, useState} from "react";
import {renderToString} from "react-dom/server";
import {act, cleanup, fireEvent, render, renderHook, waitFor} from "@testing-library/react";
import {useLocale, useNativeLocale, type LocaleReactDynamicContract} from "../index";
import {ObservableLocale} from "@locale/providers";
import {MemoryLocaleStorage} from "@locale/tests/fixtures";
import {Language, LocaleDir, type LocaleStorageDriver} from "@typing/locale";

import type {Structure} from "./tests/fixtures/dynamic-locale";

// Fixture keys differ from the generated registry; declaration fixtures verify inference separately.
const useFixtureLocale = (storage?: LocaleStorageDriver | false) =>
    useLocale(storage) as LocaleReactDynamicContract<Structure>;

afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
});

test("two roots share an instance, update immediately and keep previous render functions consistent", async () => {
    const storage = new MemoryLocaleStorage();
    const gate = Promise.withResolvers<void>();
    const originalSet = storage.set.bind(storage);
    jest.spyOn(storage, "set").mockImplementationOnce(async lang => {
        await gate.promise;
        await originalSet(lang);
    });
    const first = renderHook(() => useFixtureLocale(storage));
    const second = renderHook(() => useFixtureLocale(storage), {wrapper: StrictMode});
    const old = first.result.current;
    const provider = ObservableLocale.getInstance(storage);
    expect([...old.langs]).toEqual([Language.English, Language.French, Language.Arabic]);
    expect([...old.langNames]).toEqual([
        [Language.English, "English"],
        [Language.French, "Français"],
        [Language.Arabic, "العربية"],
    ]);
    expect([...old.langs]).toEqual([...provider.langs()]);
    expect([...old.langNames]).toEqual([...provider.langNames()]);
    expect(old.langs).toBe(provider.snapshot().langs());
    expect(old.langNames).toBe(provider.snapshot().langNames());
    let saved!: Promise<Language>;
    act(() => {
        saved = first.result.current.change(Language.French);
    });
    expect(first.result.current.lang).toBe(Language.French);
    expect(second.result.current.lang).toBe(Language.French);
    expect(first.result.current.t("greeting", {name: "Ada"})).toBe("Bonjour Ada");
    expect(old.t("greeting", {name: "Ada"})).toBe("Hello Ada");
    expect(old.choice("items", 0, {count: 0})).toBe("0 items");
    expect(first.result.current.choice("items", 0, {count: 0})).toBe("0 article");
    expect(first.result.current.change).toBe(old.change);
    expect(first.result.current.langs).toBe(old.langs);
    expect(first.result.current.langNames).toBe(old.langNames);
    expect(second.result.current.langs).toBe(old.langs);
    expect(second.result.current.langNames).toBe(old.langNames);
    expect(storage.listenerCount).toBe(1);
    await act(async () => {
        gate.resolve();
        await saved;
    });
    const current = first.result.current;
    first.rerender();
    expect(first.result.current).toBe(current);
    first.unmount();
    expect(storage.listenerCount).toBe(1);
    second.unmount();
    expect(storage.listenerCount).toBe(0);
});

test("reacts to external storage changes and rereads the choice after remounting", async () => {
    const storage = new MemoryLocaleStorage(Language.French);
    const write = jest.spyOn(storage, "set");
    const first = renderHook(() => useFixtureLocale(storage), {wrapper: StrictMode});
    await waitFor(() => expect(first.result.current.lang).toBe(Language.French));
    expect(write).not.toHaveBeenCalled();
    await act(async () => {
        await storage.set(Language.Arabic);
    });
    expect(first.result.current.dir).toBe(LocaleDir.RightToLeft);
    expect(first.result.current.isRtl).toBe(true);
    first.unmount();
    expect(storage.listenerCount).toBe(0);
    await storage.set(Language.English);
    const second = renderHook(() => useFixtureLocale(storage));
    await waitFor(() => expect(second.result.current.lang).toBe(Language.English));
});

test("memory mode is shared and independent from other drivers and native locale", async () => {
    await ObservableLocale.getInstance(false).change(Language.English);
    const first = renderHook(() => useFixtureLocale(false));
    const second = renderHook(() => useFixtureLocale(false));
    const separateStorage = new MemoryLocaleStorage();
    const separate = renderHook(() => useFixtureLocale(separateStorage));
    const native = renderHook(useNativeLocale);
    expect([...native.result.current.langs]).toEqual([...first.result.current.langs]);
    expect([...native.result.current.langNames]).toEqual([...first.result.current.langNames]);
    await act(async () => {
        await first.result.current.change(Language.French);
    });
    expect(second.result.current.lang).toBe(Language.French);
    expect(separate.result.current.lang).toBe(Language.English);
    expect(native.result.current.lang).toBe(Language.English);
});

test("changing the storage argument switches subscription ownership", async () => {
    const first = new MemoryLocaleStorage(Language.English);
    const second = new MemoryLocaleStorage(Language.French);
    const hook = renderHook(({storage}) => useFixtureLocale(storage), {initialProps: {storage: first}});
    hook.rerender({storage: second});
    await waitFor(() => expect(hook.result.current.lang).toBe(Language.French));
    expect(first.listenerCount).toBe(0);
    expect(second.listenerCount).toBe(1);
    await act(async () => {
        await first.set(Language.Arabic);
    });
    expect(hook.result.current.lang).toBe(Language.French);
});

test("keeps JSX component state while translations and plural forms change", async () => {
    const storage = new MemoryLocaleStorage();
    function Counter() {
        const [count, setCount] = useState(0);
        return createElement("button", {onClick: () => setCount(value => value + 1)}, count);
    }
    function Greeting() {
        const {t, choice} = useFixtureLocale(storage);
        return createElement(
            "main",
            null,
            createElement("p", null, t("greeting", {name: createElement(Counter)})),
            createElement("p", null, choice("items", 0, {count: createElement("b", null, "0")}))
        );
    }
    const view = render(createElement(Greeting));
    const button = view.getByRole("button");
    fireEvent.click(button);
    expect(view.container.textContent).toBe("Hello 10 items");
    await act(async () => {
        await ObservableLocale.getInstance(storage).change(Language.French);
    });
    expect(view.getByRole("button")).toBe(button);
    expect(button.textContent).toBe("1");
    expect(view.container.textContent).toBe("Bonjour 10 article");
});

test("returns save errors to the caller while displaying the selected language", async () => {
    const storage = new MemoryLocaleStorage();
    jest.spyOn(storage, "set").mockRejectedValue(new Error("read only"));
    const {result} = renderHook(() => useFixtureLocale(storage));
    await act(async () => {
        await expect(result.current.change(Language.French)).rejects.toThrow("read only");
    });
    expect(result.current.lang).toBe(Language.French);
});

test("render alone performs no storage reads or subscriptions", () => {
    const storage = new MemoryLocaleStorage();
    const read = jest.spyOn(storage, "get");
    function Greeting() {
        useFixtureLocale(storage);
        return null;
    }
    // This browser-only hook intentionally has no server snapshot; subscriptions must still stay idle.
    expect(() => renderToString(createElement(Greeting))).toThrow(/Missing getServerSnapshot/);
    expect(read).not.toHaveBeenCalled();
    expect(storage.listenerCount).toBe(0);
});
