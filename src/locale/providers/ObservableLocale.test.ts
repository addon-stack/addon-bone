jest.mock("@addon-core/browser", () => ({getI18nMessage: jest.fn(() => "en")}));
jest.mock("#adnbn/locale", () => require("./tests/fixtures/dynamic"));

import {getI18nMessage} from "@addon-core/browser";
import {ObservableLocale} from "@locale/providers";
import {MemoryLocaleStorage} from "../tests/fixtures";
import {Language, type LocaleDynamicProvider, type LocaleStorageDriver} from "@typing/locale";

import type {Structure} from "./tests/fixtures/dynamic";

afterEach(() => jest.restoreAllMocks());

test("provides current translations while snapshots retain their original language", async () => {
    const storage = new MemoryLocaleStorage();
    const write = jest.spyOn(storage, "set");
    const locale = new ObservableLocale<Structure>(storage);
    const provider: LocaleDynamicProvider<Structure> = locale;
    const initial = locale.snapshot();
    expect(provider.lang()).toBe(Language.English);
    expect(provider.langs()).toEqual(new Set([Language.English, Language.French, Language.EnglishGreatBritain]));
    expect(provider.langNames().get(Language.French)).toBe("Français");
    expect([...initial.langs()]).toEqual([...provider.langs()]);
    expect([...initial.langNames()]).toEqual([...provider.langNames()]);
    expect([...initial.langNames().keys()]).toEqual([...initial.langs()]);
    expect(provider.keys()).toContain("app.title");
    expect(provider.trans("greeting", {name: "Ada"})).toBe("Hello Ada");
    expect(locale.get("greeting")).toBe("Hello {{ name }}");
    expect(locale.get("greeting", {name: "Ada"})).toBe("Hello Ada");
    expect(provider.choice("items", 0, {count: 0})).toBe("0 items");

    const changed = provider.change(Language.French);
    expect(provider.lang()).toBe(Language.French);
    expect(provider.trans("greeting", {name: "Ada"})).toBe("Bonjour Ada");
    expect(provider.choice("items", 0, {count: 0})).toBe("0 article");
    expect(provider.trans("app.title")).toBe("Catalogue français");
    expect(provider.trans("empty")).toBe("");
    expect(locale.snapshot().get("greeting")).toBe("Bonjour {{ name }}");
    expect(initial.get("greeting")).toBe("Hello {{ name }}");
    await changed;
    expect(write).toHaveBeenCalledTimes(1);
});

test("caches default, memory, and driver instances separately without connecting storage", () => {
    const first = new MemoryLocaleStorage();
    const second = new MemoryLocaleStorage();
    const read = jest.spyOn(first, "get");
    expect(ObservableLocale.getInstance()).toBe(ObservableLocale.getInstance());
    expect(ObservableLocale.getInstance(false)).toBe(ObservableLocale.getInstance(false));
    expect(ObservableLocale.getInstance(first)).toBe(ObservableLocale.getInstance(first));
    expect(ObservableLocale.getInstance(first)).not.toBe(ObservableLocale.getInstance(second));
    expect(ObservableLocale.getInstance(false)).not.toBe(ObservableLocale.getInstance());
    expect(first.listenerCount).toBe(0);
    expect(read).not.toHaveBeenCalled();
});

test("publishes synchronously in memory and preserves previous messages and snapshot identity", async () => {
    const locale = new ObservableLocale<Structure>(false);
    const initial = locale.snapshot();
    const listener = jest.fn();
    const stop = locale.subscribe(listener);
    expect(locale.snapshot()).toBe(initial);
    expect(initial.get("greeting")).toBe("Hello {{ name }}");
    const changed = locale.change(Language.French);
    expect(locale.lang()).toBe(Language.French);
    expect(locale.snapshot().get("greeting")).toBe("Bonjour {{ name }}");
    expect(locale.snapshot().get("empty")).toBe("");
    expect(initial.get("greeting")).toBe("Hello {{ name }}");
    expect(initial.lang()).toBe(Language.English);
    expect(locale.snapshot().langs()).toBe(initial.langs());
    expect(locale.snapshot().langNames()).toBe(initial.langNames());
    expect(listener).toHaveBeenCalledTimes(1);
    await expect(changed).resolves.toBe(Language.French);
    const french = locale.snapshot();
    await locale.change(Language.French);
    expect(locale.snapshot()).toBe(french);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    await locale.change(Language.English);
    expect(listener).toHaveBeenCalledTimes(1);
});

test("connects once, restores storage and reads again after the last subscriber reconnects", async () => {
    const storage = new MemoryLocaleStorage(Language.French);
    const locale = new ObservableLocale(storage);
    const read = jest.spyOn(storage, "get");
    const write = jest.spyOn(storage, "set");
    const stopFirst = locale.subscribe(jest.fn());
    const stopSecond = locale.subscribe(jest.fn());
    expect(storage.listenerCount).toBe(1);
    await locale.sync();
    expect(locale.lang()).toBe(Language.French);
    expect(write).not.toHaveBeenCalled();
    stopFirst();
    expect(storage.listenerCount).toBe(1);
    stopSecond();
    expect(storage.listenerCount).toBe(0);
    await storage.set(Language.EnglishGreatBritain);
    const stopThird = locale.subscribe(jest.fn());
    await locale.sync();
    expect(locale.lang()).toBe(Language.EnglishGreatBritain);
    expect(read).toHaveBeenCalledTimes(4);
    stopThird();
});

test("serializes writes, saves equal selections and ignores old storage echoes", async () => {
    const storage = new MemoryLocaleStorage(Language.English);
    const locale = new ObservableLocale(storage);
    const stop = locale.subscribe(jest.fn());
    await locale.sync();
    const blocked = Promise.withResolvers<void>();
    const originalSet = storage.set.bind(storage);
    const write = jest.spyOn(storage, "set").mockImplementationOnce(async lang => {
        await blocked.promise;
        await originalSet(lang);
    });
    const first = locale.change(Language.French);
    const second = locale.change(Language.EnglishGreatBritain);
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(1);
    expect(locale.lang()).toBe(Language.EnglishGreatBritain);
    blocked.resolve();
    await Promise.all([first, second]);
    expect(write.mock.calls.map(([lang]) => lang)).toEqual([Language.French, Language.EnglishGreatBritain]);
    storage.emit(Language.French);
    await locale.sync();
    expect(locale.lang()).toBe(Language.EnglishGreatBritain);
    const snapshot = locale.snapshot();
    await locale.change(Language.EnglishGreatBritain);
    expect(locale.snapshot()).toBe(snapshot);
    expect(write).toHaveBeenCalledTimes(3);
    stop();
});

test("ignores an initial read that finishes after a local selection", async () => {
    const storage = new MemoryLocaleStorage(Language.English);
    const oldRead = Promise.withResolvers<Language>();
    jest.spyOn(storage, "get").mockImplementationOnce(() => oldRead.promise);
    const locale = new ObservableLocale(storage);
    const stop = locale.subscribe(jest.fn());
    await locale.change(Language.French);
    oldRead.resolve(Language.English);
    await oldRead.promise;
    expect(locale.lang()).toBe(Language.French);
    stop();
});

test("does not apply a read from a disconnected subscription", async () => {
    const storage = new MemoryLocaleStorage();
    const oldRead = Promise.withResolvers<Language>();
    jest.spyOn(storage, "get").mockImplementationOnce(() => oldRead.promise);
    const locale = new ObservableLocale(storage);
    const stop = locale.subscribe(jest.fn());
    stop();
    oldRead.resolve(Language.French);
    await oldRead.promise;
    expect(locale.lang()).toBe(Language.English);
});

test("rejects a failed write without rolling back a newer choice and continues the queue", async () => {
    const storage = new MemoryLocaleStorage(Language.English);
    const blocked = Promise.withResolvers<void>();
    jest.spyOn(storage, "set").mockImplementationOnce(() => blocked.promise);
    const locale = new ObservableLocale(storage);
    const first = locale.change(Language.French);
    const failure = expect(first).rejects.toThrow("write failed");
    const second = locale.change(Language.EnglishGreatBritain);
    blocked.reject(new Error("write failed"));
    await failure;
    await second;
    expect(locale.lang()).toBe(Language.EnglishGreatBritain);
    expect(storage.value).toBe(Language.EnglishGreatBritain);
    jest.spyOn(storage, "set").mockRejectedValueOnce(new Error("last write failed"));
    await expect(locale.change(Language.French)).rejects.toThrow("last write failed");
    expect(locale.lang()).toBe(Language.French);
});

test("the same callback can have independent subscriptions", async () => {
    const storage = new MemoryLocaleStorage();
    const locale = new ObservableLocale(storage);
    const listener = jest.fn();
    const first = locale.subscribe(listener);
    const second = locale.subscribe(listener);
    expect(storage.listenerCount).toBe(1);
    await locale.change(Language.French);
    expect(listener).toHaveBeenCalledTimes(2);
    listener.mockClear();
    first();
    first();
    expect(storage.listenerCount).toBe(1);
    await storage.set(Language.English);
    await locale.sync();
    expect(locale.lang()).toBe(Language.English);
    expect(listener).toHaveBeenCalledTimes(1);
    second();
    expect(storage.listenerCount).toBe(0);
});

test("a failed subscription does not leave a listener behind", async () => {
    const storage = new MemoryLocaleStorage(Language.French);
    jest.spyOn(storage, "watch").mockImplementationOnce(() => {
        throw new Error("cannot subscribe");
    });
    const locale = new ObservableLocale(storage);
    const failed = jest.fn();
    expect(() => locale.subscribe(failed)).toThrow("cannot subscribe");
    const ready = Promise.withResolvers<void>();
    const stop = locale.subscribe(() => ready.resolve());
    await ready.promise;
    expect(locale.lang()).toBe(Language.French);
    expect(failed).not.toHaveBeenCalled();
    stop();
    expect(storage.listenerCount).toBe(0);
});

test("a subscriber can select another language without reordering persistence", async () => {
    const storage = new MemoryLocaleStorage();
    const write = jest.spyOn(storage, "set");
    const locale = new ObservableLocale(storage);
    let next: Promise<Language> | undefined;
    const stop = locale.subscribe(() => {
        if (locale.lang() === Language.French) next = locale.change(Language.EnglishGreatBritain);
    });
    const first = locale.change(Language.French);
    expect(locale.lang()).toBe(Language.EnglishGreatBritain);
    expect(locale.snapshot().lang()).toBe(Language.EnglishGreatBritain);
    await first;
    await next;
    expect(write.mock.calls).toEqual([[Language.French], [Language.EnglishGreatBritain]]);
    expect(storage.value).toBe(Language.EnglishGreatBritain);
    stop();
});

test("distinct drivers can synchronize through the same physical store without echo writes", async () => {
    const storage = new MemoryLocaleStorage();
    const other: LocaleStorageDriver = {
        get: () => storage.get(),
        set: lang => storage.set(lang),
        watch: handler => storage.watch(handler),
    };
    const first = ObservableLocale.getInstance(storage);
    const second = ObservableLocale.getInstance(other);
    const write = jest.spyOn(storage, "set");
    const stops = [first.subscribe(jest.fn()), second.subscribe(jest.fn())];
    await first.change(Language.French);
    await second.sync();
    expect(first).not.toBe(second);
    expect(second.lang()).toBe(Language.French);
    expect(write).toHaveBeenCalledTimes(1);
    stops.forEach(stop => stop());
});

test("validates selections and saved languages without publishing an invalid snapshot", async () => {
    const storage = new MemoryLocaleStorage(Language.German);
    const locale = new ObservableLocale(storage);
    const snapshot = locale.snapshot();
    const warn = jest.spyOn(console, "warn").mockImplementation();
    await locale.sync();
    expect(warn).toHaveBeenCalledWith('Incorrect language code in storage - "de"');
    await expect(locale.change(Language.German)).rejects.toThrow('Language "de" is not available');
    expect(locale.snapshot()).toBe(snapshot);
    expect(storage.value).toBe(Language.German);
});

test("an invalid choice neither writes nor invalidates a pending storage read", async () => {
    const storage = new MemoryLocaleStorage();
    const read = Promise.withResolvers<Language>();
    jest.spyOn(storage, "get").mockImplementationOnce(() => read.promise);
    const write = jest.spyOn(storage, "set");
    const locale = new ObservableLocale(storage);
    const initial = locale.snapshot();
    const synced = locale.sync();
    await expect(locale.change(Language.German)).rejects.toThrow('Language "de" is not available');
    expect(locale.snapshot()).toBe(initial);
    expect(write).not.toHaveBeenCalled();
    read.resolve(Language.French);
    await synced;
    expect(locale.lang()).toBe(Language.French);
    expect(locale.snapshot().lang()).toBe(Language.French);
});

test("snapshots treat missing prototype keys as missing messages", () => {
    const locale = new ObservableLocale<Record<string, {plural: false; substitutions: []}>>(false);
    const warn = jest.spyOn(console, "warn").mockImplementation();
    expect(locale.snapshot().get("toString")).toBe("toString");
    expect(warn).toHaveBeenCalledWith('Locale key "toString" not found in "en" language.');
    expect(locale.snapshot().get("__proto__")).toBe("Ordinary message");
});

test("reports background synchronization errors and still releases the listener", async () => {
    const storage = new MemoryLocaleStorage();
    const failure = new Error("read failed");
    jest.spyOn(storage, "get").mockRejectedValue(failure);
    const report = jest.spyOn(console, "error").mockImplementation();
    const locale = new ObservableLocale(storage);
    const stop = locale.subscribe(jest.fn());
    await Promise.resolve();
    await Promise.resolve();
    expect(report).toHaveBeenCalledWith("[ObservableLocale] Cannot synchronize language:", failure);
    stop();
    expect(storage.listenerCount).toBe(0);
});

test("custom storage and memory mode work when browser i18n is unavailable", async () => {
    jest.mocked(getI18nMessage).mockImplementation(() => {
        throw new Error("No i18n");
    });
    const locale = new ObservableLocale(new MemoryLocaleStorage(Language.English));
    expect(locale.lang()).toBe(Language.French);
    await locale.sync();
    expect(locale.lang()).toBe(Language.English);
    const memory = new ObservableLocale(false);
    await memory.change(Language.English);
    expect(memory.lang()).toBe(Language.English);
    await expect(memory.sync()).rejects.toThrow("Language is not saving in storage");
    jest.mocked(getI18nMessage).mockReturnValue("en");
});
