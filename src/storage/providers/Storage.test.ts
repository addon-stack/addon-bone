import Storage from "./Storage";
import MonoStorage from "./MonoStorage";

const hasArea = (name: keyof typeof chrome.storage) => {
    const area = (chrome.storage as any)[name];
    return area && typeof area.get === "function" && typeof area.clear === "function";
};

const clearAllAreas = async () => {
    const areas: (keyof typeof chrome.storage)[] = ["local", "sync", "managed", "session"] as any;
    for (const a of areas) {
        if (hasArea(a)) {
            await new Promise<void>(resolve => (chrome.storage as any)[a].clear(() => resolve()));
        }
    }
};

const getAllFromArea = async (name: keyof typeof chrome.storage) => {
    return await new Promise<Record<string, any>>(resolve => (chrome.storage as any)[name].get(null, resolve));
};

const namespace = "user";
const storage = new Storage();
const storageWithNamespace = new Storage({namespace});

beforeEach(async () => {
    await clearAllAreas();
});

test("set method - saves data with namespace", async () => {
    await storageWithNamespace.set("theme", "dark");
    const result = await global.storageLocalGet("theme", storageWithNamespace);
    const secondResult = (await storageWithNamespace.getAll())["theme"];

    expect(result).toEqual("dark");
    expect(secondResult).toEqual("dark");
});

test("getAll method - returns all values from current namespace", async () => {
    await storage.set("a", 1);
    await storage.set("b", 2);
    await storageWithNamespace.set("c", 3);
    await storageWithNamespace.set("d", 4);

    const result = await storage.getAll();
    const resultWithNamespace = await storageWithNamespace.getAll();

    expect(result).toEqual({a: 1, b: 2});
    expect(resultWithNamespace).toEqual({c: 3, d: 4});
});

test("clear method - removes all keys from current namespace", async () => {
    await storage.set("a", 1);
    await storage.set("b", 2);
    await storageWithNamespace.set("c", 3);
    await storageWithNamespace.set("d", 4);

    await storage.clear();

    const result = await storage.getAll();
    const resultWithNamespace = await storageWithNamespace.getAll();

    expect(result).toEqual({});
    expect(resultWithNamespace).toEqual({c: 3, d: 4});
});

describe("set/get methods with different type of value", () => {
    test.each([
        ["string", "hello"],
        ["number", 42],
        ["boolean", true],
        ["null", null],
        ["undefined", undefined],
        ["object", {a: 1, b: true}],
        ["array", [1, 2, 3]],
    ])("set/get with %s", async (_, value) => {
        await storage.set("key", value);
        const result = await storage.get("key");
        expect(result).toEqual(value);
    });
});

describe("remove method", () => {
    test("deletes the key without namespace", async () => {
        await storage.set("theme", "dark");
        await storage.remove("theme");
        const result = await global.storageLocalGet("theme");
        expect(result).toBeUndefined();
    });

    test("deletes the key with namespace", async () => {
        await storageWithNamespace.set("theme", "dark");
        await storageWithNamespace.remove("theme");
        const result = await global.storageLocalGet("theme", storageWithNamespace);
        expect(result).toBeUndefined();
    });
});

describe("watch method", () => {
    test("calls specific key callback on change", () => {
        const keyCallback = jest.fn();
        storage.watch({theme: keyCallback});

        global.simulateStorageChange({storage, key: "theme", oldValue: "light", newValue: "dark"});

        expect(keyCallback).toHaveBeenCalledWith("dark", "light");
    });

    test("does not call key callback for unrelated key", () => {
        const keyCallback = jest.fn();
        storage.watch({theme: keyCallback});

        global.simulateStorageChange({storage, key: "volume", oldValue: 50, newValue: 80});

        expect(keyCallback).not.toHaveBeenCalled();
    });

    test("calls global callback on any change", () => {
        const globalCallback = jest.fn();
        storage.watch(globalCallback);

        global.simulateStorageChange({storage, key: "theme", oldValue: "light", newValue: "dark"});
        global.simulateStorageChange({storage, key: "volume", oldValue: 50, newValue: 80});

        expect(globalCallback).toHaveBeenCalledWith(80, 50);
        expect(globalCallback).toHaveBeenCalledWith("dark", "light");
    });

    test("calls both key and global callbacks", () => {
        const keyCallback = jest.fn();
        const globalCallback = jest.fn();
        storage.watch({theme: keyCallback});
        storage.watch(globalCallback);

        global.simulateStorageChange({storage, key: "theme", oldValue: "light", newValue: "dark"});
        global.simulateStorageChange({storage, key: "volume", oldValue: 50, newValue: 80});

        expect(keyCallback).toHaveBeenCalledWith("dark", "light");
        expect(globalCallback).toHaveBeenCalledWith(80, 50);
        expect(globalCallback).toHaveBeenCalledWith("dark", "light");
    });
});

// Static factory methods tests migrated from AbstractStorage.static.test.ts

describe("static factory methods", () => {
    describe("make()", () => {
        test("Storage.make() returns provider by default and MonoStorage with key", async () => {
            const s = Storage.make();
            expect(s).toBeInstanceOf(Storage);

            const mono = Storage.make({key: "bucket"});
            expect(mono).toBeInstanceOf(MonoStorage);

            // default area is local; write and verify stored in local only
            await (s as Storage<any>).set("a" as any, 1 as any);

            const localAll = await getAllFromArea("local");
            expect(localAll["a"]).toBe(1);

            if (hasArea("sync")) {
                const syncAll = await getAllFromArea("sync");
                expect(syncAll["a"]).toBeUndefined();
            }
            if (hasArea("managed")) {
                const managedAll = await getAllFromArea("managed");
                expect(managedAll["a"]).toBeUndefined();
            }
            if (hasArea("session")) {
                const sessionAll = await getAllFromArea("session");
                expect(sessionAll["a"]).toBeUndefined();
            }
        });
    });

    describe("Area shortcuts (Local/Sync/Session/Managed)", () => {
        test("Storage.Local() writes to local area and returns Storage/MonoStorage accordingly", async () => {
            const s = Storage.Local();
            expect(s).toBeInstanceOf(Storage);
            await (s as Storage<any>).set("x" as any, 10 as any);

            const localAll = await getAllFromArea("local");
            expect(localAll["x"]).toBe(10);

            if (hasArea("sync")) {
                const syncAll = await getAllFromArea("sync");
                expect(syncAll["x"]).toBeUndefined();
            }

            const mono = Storage.Local({key: "bucket"});
            expect(mono).toBeInstanceOf(MonoStorage);
            await (mono as unknown as MonoStorage<any, any>).set("a" as any, 1 as any);
            const localAll2 = await getAllFromArea("local");
            expect(localAll2["bucket"]).toEqual({a: 1});
        });

        test("Storage.Sync() writes to sync area", async () => {
            if (!hasArea("sync")) {
                return; // environment doesn't support sync in this mock version
            }
            const s = Storage.Sync();
            expect(s).toBeInstanceOf(Storage);
            await (s as Storage<any>).set("x" as any, 10 as any);

            const syncAll = await getAllFromArea("sync");
            expect(syncAll["x"]).toBe(10);

            const localAll = await getAllFromArea("local");
            expect(localAll["x"]).toBeUndefined();

            const mono = Storage.Sync({key: "bucket"});
            expect(mono).toBeInstanceOf(MonoStorage);
            await (mono as unknown as MonoStorage<any, any>).set("a" as any, 1 as any);
            const syncAll2 = await getAllFromArea("sync");
            expect(syncAll2["bucket"]).toEqual({a: 1});
        });

        test("Storage.Managed() writes to managed area", async () => {
            if (!hasArea("managed")) {
                return;
            }
            const s = Storage.Managed();
            expect(s).toBeInstanceOf(Storage);
            await (s as Storage<any>).set("m" as any, 7 as any);

            const managedAll = await getAllFromArea("managed");
            expect(managedAll["m"]).toBe(7);

            const localAll = await getAllFromArea("local");
            expect(localAll["m"]).toBeUndefined();
        });

        test("Storage.Session() writes to session area if available", async () => {
            if (!hasArea("session")) {
                return;
            }
            const s = Storage.Session();
            expect(s).toBeInstanceOf(Storage);
            await (s as Storage<any>).set("s" as any, 5 as any);

            const sessionAll = await getAllFromArea("session");
            expect(sessionAll["s"]).toBe(5);

            const localAll = await getAllFromArea("local");
            expect(localAll["s"]).toBeUndefined();
        });
    });
});
