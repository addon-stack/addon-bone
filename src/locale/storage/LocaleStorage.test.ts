jest.mock("@addon-core/storage", () => ({Storage: {Local: jest.fn()}}));

import {Storage, type StorageProvider} from "@addon-core/storage";
import {LocaleStorage} from "./index";
import {Language} from "@typing/locale";

type Watcher = {locale?: (value: unknown) => void};
let value: unknown;
const listeners = new Set<Watcher>();
const emit = (next: unknown) => {
    value = next;
    for (const watcher of listeners) watcher.locale?.(next);
};
const provider = {
    get: jest.fn(async (_key: string): Promise<unknown> => value),
    set: jest.fn(async (_key: string, next: Language) => emit(next)),
    watch: jest.fn((watcher: Watcher) => {
        listeners.add(watcher);
        return () => listeners.delete(watcher);
    }),
};

beforeEach(() => {
    value = undefined;
    listeners.clear();
    jest.clearAllMocks();
    jest.mocked(Storage.Local).mockReturnValue(provider as unknown as StorageProvider<{locale: Language}>);
});

afterEach(() => jest.restoreAllMocks());

test("uses the package namespace and locale key without reading or subscribing at construction", async () => {
    const storage = new LocaleStorage();
    expect(Storage.Local).toHaveBeenCalledWith({namespace: "adnbn"});
    expect(provider.get).not.toHaveBeenCalled();
    expect(provider.watch).not.toHaveBeenCalled();
    await expect(storage.get()).resolves.toBeUndefined();
    expect(provider.get).toHaveBeenCalledWith("locale");
    await storage.set(Language.French);
    expect(provider.set).toHaveBeenCalledWith("locale", Language.French);
    await expect(storage.get()).resolves.toBe(Language.French);
});

test.each([Language.English, Language.EnglishGreatBritain, Language.German])(
    "reads a language independently of the application catalogue: %s",
    async lang => {
        value = lang;
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
        emit(invalid);
        await expect(storage.get()).resolves.toBeUndefined();
        expect(handler).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledWith("[LocaleStorage] Invalid language code in storage:", invalid);
        expect(provider.set).not.toHaveBeenCalled();
        stop();
    }
);

test("notifies every subscriber of own and external selections, ignores deletion and unsubscribes independently", async () => {
    const storage = new LocaleStorage();
    const first = jest.fn();
    const second = jest.fn();
    const stopFirst = storage.watch(first);
    const stopSecond = storage.watch(second);
    expect(first).not.toHaveBeenCalled();
    emit(Language.German);
    await storage.set(Language.French);
    emit(undefined);
    expect(first.mock.calls).toEqual([[Language.German], [Language.French]]);
    expect(second.mock.calls).toEqual(first.mock.calls);
    stopFirst();
    stopFirst();
    emit(Language.English);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenLastCalledWith(Language.English);
    stopSecond();
    expect(listeners.size).toBe(0);
    expect(provider.set).toHaveBeenCalledTimes(1);
});

test("propagates storage errors to the caller", async () => {
    const error = new Error("Storage denied");
    provider.get.mockRejectedValueOnce(error);
    provider.set.mockRejectedValueOnce(error);
    const storage = new LocaleStorage();
    await expect(storage.get()).rejects.toBe(error);
    await expect(storage.set(Language.French)).rejects.toBe(error);
});
