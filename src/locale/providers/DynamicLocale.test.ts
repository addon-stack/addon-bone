jest.mock("#adnbn/locale", () => require("./tests/fixtures/dynamic"));

import {getBrowserTest} from "@tests/browser-harness/session";
import DynamicLocale from "./DynamicLocale";
import {MemoryLocaleStorage} from "../tests/fixtures";
import {Language} from "@typing/locale";

import type {Structure} from "./tests/fixtures/dynamic";

const keys = ["greeting", "items", "app.title", "fallback", "empty", "__proto__"];
const i18n = () => getBrowserTest().harness.configurable.chrome.i18n.getMessage;
const storageHarness = () => getBrowserTest().harness.storage;
const stored = () => storageHarness().local.data["adnbn:locale"];

const notify = async (value: string | undefined) => {
    if (value === undefined) {
        await chrome.storage.local.remove("adnbn:locale");
    } else {
        await chrome.storage.local.set({"adnbn:locale": value});
    }

    await storageHarness().flushChanges();
};

const seed = async (value: string | undefined) => {
    await notify(value);
    // Fixture preparation should not count as a write by the provider under test.
    storageHarness().local.set.reset();
};

beforeEach(() => {
    i18n().setResult("en");
});

test("reads the initial language from browser i18n and translates synchronously from the catalogue", () => {
    const locale = new DynamicLocale<Structure>();
    expect(locale.lang()).toBe(Language.English);
    expect(locale.trans("greeting", {name: "Ada"})).toBe("Hello Ada");
    expect(locale.trans("app.title")).toBe("Catalogue");
    expect(locale.trans("empty")).toBe("");
    expect(locale.trans("__proto__")).toBe("Ordinary message");
    expect(locale.choice("items", 2, {count: 2})).toBe("2 items");
    expect(i18n().calls).toHaveLength(1);
    expect(i18n().calls[0].args[0]).toBe("locale");
    expect(storageHarness().local.get.calls).toHaveLength(0);
    expect(storageHarness().onChanged.listenerCount()).toBe(0);
});

test("exposes completed messages while retaining previously selected dictionaries", async () => {
    const locale = new DynamicLocale<Structure>(false);
    const english = locale.messages();
    expect(locale.messages()).toBe(english);
    expect(english).toMatchObject({
        locale: "en",
        greeting: "Hello {{ name }}",
        app_title: "Catalogue",
        items: "{{count}} item|{{count}} items",
        fallback: "Shared default message",
        empty: "",
    });
    expect(Object.hasOwn(english, "app.title")).toBe(false);

    const changed = locale.change(Language.French);
    const french = locale.messages();
    expect(french).not.toBe(english);
    expect(french.app_title).toBe("Catalogue français");
    expect(french.fallback).toBe("Shared default message");
    expect(english.app_title).toBe("Catalogue");
    await changed;
    await locale.change(Language.English);
    expect(locale.messages()).toBe(english);
});

test("normalizes the native marker before selecting catalogue data", () => {
    i18n().setResult("en-GB");
    const locale = new DynamicLocale<Structure>(false);
    expect(locale.lang()).toBe(Language.English);
    expect(locale.trans("app.title")).toBe("Catalogue");
});

test.each([undefined, "", "unknown"])("uses the build language when the native marker is invalid: %s", marker => {
    i18n().setImplementation(() => marker as string);
    const locale = new DynamicLocale<Structure>(false);
    expect(locale.lang()).toBe(Language.French);
    expect(locale.trans("greeting", {name: "Ada"})).toBe("Bonjour Ada");
});

test("uses the build language when browser i18n is unavailable and changes synchronously in memory", async () => {
    getBrowserTest().harness.capabilities.set("i18n.getMessage", false);
    const locale = new DynamicLocale<Structure>(false);
    expect(locale.lang()).toBe(Language.French);
    expect(locale.trans("greeting", {name: "Ada"})).toBe("Bonjour Ada");
    const changed = locale.change(Language.English);
    expect(locale.trans("greeting", {name: "Ada"})).toBe("Hello Ada");
    await expect(changed).resolves.toBe(Language.English);
    expect(storageHarness().local.get.calls).toHaveLength(0);
    expect(storageHarness().onChanged.listenerCount()).toBe(0);
    expect(i18n().calls).toHaveLength(0);
});

test("rejects a recognized native language that is absent from the catalogue", () => {
    const marker = "de";
    i18n().setResult(marker);
    expect(() => new DynamicLocale(false)).toThrow('Language "de" is not available');
});

test("keeps public dot keys separate from catalogue keys and exposes available languages", () => {
    const locale = new DynamicLocale<Structure>(false);
    expect([...locale.keys()]).toEqual(keys);
    expect([...locale.langs()]).toEqual([Language.English, Language.French, Language.EnglishGreatBritain]);
    expect([...locale.langNames()]).toEqual([
        [Language.English, "English"],
        [Language.French, "Français"],
        [Language.EnglishGreatBritain, "English (United Kingdom)"],
    ]);
    locale.keys().clear();
    expect(locale.keys().size).toBe(keys.length);
});

test("selects without saving and throws synchronously for an unavailable language without changing state", async () => {
    await seed(Language.English);
    const locale = new DynamicLocale<Structure>();

    expect(locale.select(Language.French)).toBe(Language.French);
    expect(locale.lang()).toBe(Language.French);
    expect(locale.trans("greeting", {name: "Ada"})).toBe("Bonjour Ada");
    expect(storageHarness().local.set.calls).toHaveLength(0);
    expect(stored()).toBe(Language.English);

    const messages = locale.messages();

    expect(() => locale.select(Language.German)).toThrow('Language "de" is not available');
    expect(locale.lang()).toBe(Language.French);
    expect(locale.messages()).toBe(messages);
    expect(storageHarness().local.set.calls).toHaveLength(0);
    expect(stored()).toBe(Language.English);
});

test("switches messages immediately while waiting for storage persistence", async () => {
    const write = Promise.withResolvers<void>();
    const storage = new MemoryLocaleStorage();
    const persist = storage.set.bind(storage);
    const save = jest.spyOn(storage, "set").mockImplementationOnce(async lang => {
        await write.promise;
        await persist(lang);
    });

    const locale = new DynamicLocale<Structure>(storage);
    const saved = locale.change(Language.French);
    expect(locale.lang()).toBe(Language.French);
    expect(locale.trans("greeting", {name: "Ada"})).toBe("Bonjour Ada");
    expect(locale.choice("items", 0, {count: 0})).toBe("0 article");
    expect(locale.trans("fallback")).toBe("Shared default message");
    expect(locale.trans("empty")).toBe("");
    expect(save).toHaveBeenCalledWith(Language.French);
    expect(storage.value).toBeUndefined();
    write.resolve();
    await expect(saved).resolves.toBe(Language.French);
    expect(storage.value).toBe(Language.French);
});

test("persists a repeated selection of the current language under the framework namespace and locale key", async () => {
    const locale = new DynamicLocale();
    await locale.change(Language.English);
    expect(storageHarness().local.data).toEqual({"adnbn:locale": Language.English});
    expect(storageHarness().local.set.calls.at(-1)?.args).toEqual([{"adnbn:locale": Language.English}]);
    expect(stored()).toBe(Language.English);
});

test("rejects write errors without rolling back a newer selection", async () => {
    const write = Promise.withResolvers<void>();
    const storage = new MemoryLocaleStorage();

    jest.spyOn(storage, "set").mockImplementationOnce(() => write.promise);

    const locale = new DynamicLocale(storage);
    const first = locale.change(Language.French);
    await locale.change(Language.EnglishGreatBritain);
    const error = new Error("Storage write failed");
    write.reject(error);
    await expect(first).rejects.toBe(error);
    expect(locale.lang()).toBe(Language.EnglishGreatBritain);
});

test("ignores prototype properties and rejects languages absent from the application catalogue", async () => {
    const locale = new DynamicLocale<Record<string, {plural: false; substitutions: []}>>(false);
    const warn = jest.spyOn(console, "warn").mockImplementation();
    expect(locale.trans("toString")).toBe("toString");
    expect(warn).toHaveBeenCalledWith('Locale key "toString" not found in "en" language.');
    await expect(locale.change(Language.German)).rejects.toThrow('Language "de" is not available');
    await expect(locale.change("__proto__" as Language)).rejects.toThrow("is not available");
    expect(locale.lang()).toBe(Language.English);
    expect(storageHarness().local.set.calls).toHaveLength(0);
});

test("restores the saved language only through explicit sync, without writing it back", async () => {
    await seed(Language.French);
    const locale = new DynamicLocale();
    expect(locale.lang()).toBe(Language.English);
    expect(storageHarness().local.get.calls).toHaveLength(0);
    await expect(locale.sync()).resolves.toBe(Language.French);
    expect(storageHarness().local.get.calls.at(-1)?.args).toEqual(["adnbn:locale"]);
    expect(storageHarness().local.set.calls).toHaveLength(0);
});

test.each([undefined, "de"])("keeps the current language for invalid or absent storage: %s", async value => {
    await seed(value);
    const warn = jest.spyOn(console, "warn").mockImplementation();
    const locale = new DynamicLocale();
    await expect(locale.sync()).resolves.toBe(Language.English);
    expect(storageHarness().local.set.calls).toHaveLength(0);

    if (value) {
        expect(warn).toHaveBeenCalledWith(`Incorrect language code in storage - "${value}"`);
    } else {
        expect(warn).not.toHaveBeenCalled();
    }
});

test("propagates storage read errors without changing the language", async () => {
    const error = new Error("Storage read failed");
    storageHarness().local.get.failNext(error);
    const locale = new DynamicLocale();
    await expect(locale.sync()).rejects.toThrow(error.message);
    expect(locale.lang()).toBe(Language.English);
});

test("applies external changes and own storage events without another write", async () => {
    const locale = new DynamicLocale();
    const handler = jest.fn();
    const stop = locale.watch(handler);

    getBrowserTest().addCleanup(stop);
    await notify(Language.French);
    expect(locale.lang()).toBe(Language.French);
    expect(handler).toHaveBeenLastCalledWith(Language.French);
    expect(storageHarness().local.set.calls).toHaveLength(1);
    await locale.change(Language.English);
    await storageHarness().flushChanges();
    expect(handler).toHaveBeenLastCalledWith(Language.English);
    expect(storageHarness().local.set.calls).toHaveLength(2);
    expect(handler).toHaveBeenCalledTimes(2);
    stop();
    stop();
    await notify(Language.French);
    expect(locale.lang()).toBe(Language.English);
    expect(storageHarness().onChanged.listenerCount()).toBe(0);
});

test("retains the single-listener contract and permits subscribing again after unwatch", () => {
    const locale = new DynamicLocale();
    getBrowserTest().addCleanup(() => locale.unwatch());
    locale.watch();
    expect(() => locale.watch()).toThrow("Already subscribed");
    locale.unwatch();
    locale.watch();
    expect(storageHarness().onChanged.listenerCount()).toBe(1);
    locale.unwatch();
    expect(storageHarness().onChanged.listenerCount()).toBe(0);
});

test("reports invalid external changes without changing state or notifying the handler", async () => {
    const locale = new DynamicLocale();
    const error = jest.spyOn(console, "error").mockImplementation();
    const handler = jest.fn();
    const stop = locale.watch(handler);

    getBrowserTest().addCleanup(stop);
    await notify(Language.German);
    await notify(undefined);
    expect(error).toHaveBeenCalledWith("Error while changing language:", expect.any(Error));
    expect(handler).not.toHaveBeenCalled();
    expect(locale.lang()).toBe(Language.English);
    expect(storageHarness().local.set.calls).toHaveLength(1);
    stop();
});

test("supports memory-only changes without creating storage", async () => {
    const locale = new DynamicLocale(false);
    const changed = locale.change(Language.French);
    expect(locale.lang()).toBe(Language.French);
    await expect(changed).resolves.toBe(Language.French);
    expect(storageHarness().local.get.calls).toHaveLength(0);
    expect(storageHarness().onChanged.listenerCount()).toBe(0);
    expect(storageHarness().local.set.calls).toHaveLength(0);
    await expect(locale.sync()).rejects.toThrow("Language is not saving in storage");
    expect(() => locale.watch()).toThrow("Language is not saved in storage");
    expect(() => locale.unwatch()).not.toThrow();
});

test("uses a custom driver without constructing extension storage, including without browser i18n", async () => {
    getBrowserTest().harness.capabilities.set("i18n.getMessage", false);
    const storage = new MemoryLocaleStorage(Language.English);
    const write = jest.spyOn(storage, "set");
    const locale = new DynamicLocale<Structure>(storage);
    expect(locale.lang()).toBe(Language.French);
    await expect(locale.sync()).resolves.toBe(Language.English);
    const handler = jest.fn();
    const stop = locale.watch(handler);

    getBrowserTest().addCleanup(stop);
    const saved = locale.change(Language.French);
    expect(locale.trans("greeting", {name: "Ada"})).toBe("Bonjour Ada");
    await expect(saved).resolves.toBe(Language.French);
    expect(handler).toHaveBeenCalledWith(Language.French);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(Language.French);
    stop();
    await storage.set(Language.English);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(locale.lang()).toBe(Language.French);
    expect(storageHarness().local.get.calls).toHaveLength(0);
    expect(storageHarness().onChanged.listenerCount()).toBe(0);
});

test("shares a supplied driver while keeping different drivers independent", async () => {
    const storage = new MemoryLocaleStorage();
    const first = new DynamicLocale(storage);
    const second = new DynamicLocale(storage);
    const independent = new DynamicLocale(new MemoryLocaleStorage());
    const stopFirst = first.watch();
    const stopSecond = second.watch();
    const stopIndependent = independent.watch();
    await first.change(Language.French);
    expect(second.lang()).toBe(Language.French);
    expect(independent.lang()).toBe(Language.English);
    stopSecond();
    await first.change(Language.EnglishGreatBritain);
    expect(second.lang()).toBe(Language.French);
    stopFirst();
    stopIndependent();
});

test("propagates custom driver read and write errors without rolling back the selected language", async () => {
    const storage = new MemoryLocaleStorage();
    const error = new Error("Custom storage failed");
    jest.spyOn(storage, "get").mockRejectedValueOnce(error);
    jest.spyOn(storage, "set").mockRejectedValueOnce(error);
    const locale = new DynamicLocale(storage);
    await expect(locale.sync()).rejects.toBe(error);
    await expect(locale.change(Language.French)).rejects.toBe(error);
    expect(locale.lang()).toBe(Language.French);
});
