import {getBrowserTest} from "@tests/browser-harness/session";
import {LocaleStorage} from "./index";
import {Language} from "@typing/locale";

const storageHarness = () => getBrowserTest().harness.storage;

const emit = async (value: unknown) => {
    if (value === undefined) {
        await chrome.storage.local.remove("adnbn:locale");
    } else {
        await chrome.storage.local.set({"adnbn:locale": value});
    }

    await storageHarness().flushChanges();
};

test("uses the package namespace and locale key without reading or subscribing at construction", async () => {
    const storage = new LocaleStorage();

    expect(storageHarness().local.get.calls).toHaveLength(0);
    expect(storageHarness().onChanged.listenerCount()).toBe(0);
    await expect(storage.get()).resolves.toBeUndefined();
    expect(storageHarness().local.get.calls.at(-1)?.args).toEqual(["adnbn:locale"]);
    await storage.set(Language.French);
    expect(storageHarness().local.set.calls.at(-1)?.args).toEqual([{"adnbn:locale": Language.French}]);
    expect(storageHarness().local.data).toEqual({"adnbn:locale": Language.French});
    await expect(storage.get()).resolves.toBe(Language.French);
});

test.each([Language.English, Language.EnglishGreatBritain, Language.German])(
    "reads a language independently of the application catalogue: %s",
    async lang => {
        await emit(lang);
        await expect(new LocaleStorage().get()).resolves.toBe(lang);
    }
);

test.each([null, "", "unknown", "__proto__", "en-GB", 1, {}, ["en"]])(
    "ignores invalid stored values in reads and notifications: %p",
    async invalid => {
        const warn = jest.spyOn(console, "warn").mockImplementation();
        const storage = new LocaleStorage();
        const handler = jest.fn();
        const stop = storage.watch(handler);

        getBrowserTest().addCleanup(stop);
        await emit(invalid);
        await expect(storage.get()).resolves.toBeUndefined();
        expect(handler).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledWith("[LocaleStorage] Invalid language code in storage:", invalid);
        // Only the external write; validation must not rewrite the invalid value.
        expect(storageHarness().local.set.calls).toHaveLength(1);
        stop();
    }
);

test("notifies every subscriber of own and external selections, ignores deletion and unsubscribes independently", async () => {
    const storage = new LocaleStorage();
    const first = jest.fn();
    const second = jest.fn();
    const stopFirst = storage.watch(first);
    const stopSecond = storage.watch(second);

    getBrowserTest().addCleanup(stopFirst);
    getBrowserTest().addCleanup(stopSecond);
    expect(first).not.toHaveBeenCalled();
    await emit(Language.German);
    await storage.set(Language.French);
    await storageHarness().flushChanges();
    await emit(undefined);
    expect(first.mock.calls).toEqual([[Language.German], [Language.French]]);
    expect(second.mock.calls).toEqual(first.mock.calls);
    stopFirst();
    stopFirst();
    await emit(Language.English);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenLastCalledWith(Language.English);
    stopSecond();
    expect(storageHarness().onChanged.listenerCount()).toBe(0);
    expect(storageHarness().local.set.calls).toHaveLength(3);
});

test("propagates storage errors to the caller", async () => {
    const error = new Error("Storage denied");

    storageHarness().local.get.failNext(error);
    storageHarness().local.set.failNext(error);

    const storage = new LocaleStorage();

    await expect(storage.get()).rejects.toThrow("Storage denied");
    await expect(storage.set(Language.French)).rejects.toThrow("Storage denied");
});
