import Storage from "./Storage";
import SecureStorage from "./SecureStorage";
import MonoStorage from "./MonoStorage";

interface BucketState {
    a?: number;
    b?: {x: number} | number | string;
    c?: string;
}

const key = "bucket" as const;

let base: Storage<Record<typeof key, Partial<BucketState>>>;
let secureBase: SecureStorage<Record<typeof key, Partial<BucketState>>>;

beforeEach(async () => {
    base = new Storage();
    secureBase = new SecureStorage();
    await chrome.storage.local.clear();

    // Patch .get due to jest-webextension-mock limitation on chrome.storage.get(key)
    // Storage: use storageLocalGet to fetch specific key reliably in tests
    const baseGet = base.get.bind(base);
    base.get = (async (k: any) => {
        try {
            // Use helper to accurately read the specific full key from mock storage
            return await (global as any).storageLocalGet(k, base);
        } catch {
            // fallback to original if needed
            return baseGet(k);
        }
    }) as any;

    // SecureStorage: we need decrypted value; derive from getAll() which decrypts
    const secureGet = secureBase.get.bind(secureBase);
    secureBase.get = (async (k: any) => {
        try {
            const all = await secureBase.getAll();
            return (all as any)[k];
        } catch {
            return secureGet(k);
        }
    }) as any;
});

test("constructor validates non-empty key", () => {
    expect(() => new MonoStorage("" as any, base)).toThrow(/non-empty string/);

    expect(() => new MonoStorage<BucketState, typeof key>(key as any, base as any)).not.toThrow();
});

test("set/get basic behavior", async () => {
    const mono = new MonoStorage<BucketState, typeof key>(key, base);
    await mono.set("a", 1);
    await mono.set("c", "hello");

    expect(await mono.get("a")).toBe(1);
    expect(await mono.get("c")).toBe("hello");

    // underlying physical record is a single object under key
    const raw = await (global as any).storageLocalGet(key, base);
    expect(raw).toEqual({a: 1, c: "hello"});
});

test("getAll returns the whole bucket", async () => {
    const mono = new MonoStorage<BucketState, typeof key>(key, base);
    await mono.set("a", 1);
    await mono.set("b", {x: 2});

    expect(await mono.getAll()).toEqual({a: 1, b: {x: 2}});
});

test("set(undefined) deletes key and removes physical entry when empty", async () => {
    const mono = new MonoStorage<BucketState, typeof key>(key, base);
    await mono.set("a", 1);
    await mono.set("b", 2);

    await mono.set("a", undefined as any);
    expect(await mono.get("a")).toBeUndefined();
    let raw = await (global as any).storageLocalGet(key, base);
    expect(raw).toEqual({b: 2});

    await mono.set("b", undefined as any);
    // physical key should be removed entirely
    raw = await (global as any).storageLocalGet(key, base);
    expect(raw).toBeUndefined();
});

test("remove single and multiple keys; remove physical when bucket empty", async () => {
    const mono = new MonoStorage<BucketState, typeof key>(key, base);
    await mono.set("a", 1);
    await mono.set("b", 2);
    await mono.set("c", "z");

    await mono.remove("b");
    expect(await mono.getAll()).toEqual({a: 1, c: "z"});

    await mono.remove(["a", "c"]);
    const raw = await (global as any).storageLocalGet(key, base);
    expect(raw).toBeUndefined();
});

test("clear removes the physical key", async () => {
    const mono = new MonoStorage<BucketState, typeof key>(key, base);
    await mono.set("a", 1);
    await mono.set("b", 2);

    await mono.clear();
    const raw = await (global as any).storageLocalGet(key, base);
    expect(raw).toBeUndefined();
    expect(await mono.getAll()).toEqual({});
});

describe("watch", () => {
    test("global callback receives whole object on changes", () => {
        const mono = new MonoStorage<BucketState, typeof key>(key, base);
        const cb = jest.fn();
        mono.watch(cb);

        // simulate change on underlying storage physical key
        (global as any).simulateStorageChange({
            storage: base,
            key,
            oldValue: {a: 1},
            newValue: {a: 2, c: "x"},
        });

        expect(cb).toHaveBeenCalledWith({a: 2, c: "x"}, {a: 1});
    });

    test("keyed callbacks fan-out only on changed keys", () => {
        const mono = new MonoStorage<BucketState, typeof key>(key, base);
        const cbA = jest.fn();
        const cbB = jest.fn();
        const cbC = jest.fn();
        mono.watch({a: cbA, b: cbB, c: cbC});

        (global as any).simulateStorageChange({
            storage: base,
            key,
            oldValue: {a: 1, b: 2},
            newValue: {a: 3, b: 2, c: "x"},
        });

        expect(cbA).toHaveBeenCalledWith(3, 1); // changed
        expect(cbB).not.toHaveBeenCalled(); // unchanged
        expect(cbC).toHaveBeenCalledWith("x", undefined); // added
    });

    test("shallowEqual prevents notifications for equal objects", () => {
        const mono = new MonoStorage<BucketState, typeof key>(key, base);
        const cbB = jest.fn();
        mono.watch({b: cbB});

        (global as any).simulateStorageChange({
            storage: base,
            key,
            oldValue: {b: {x: 1}},
            newValue: {b: {x: 1}}, // shallowly equal
        });

        expect(cbB).not.toHaveBeenCalled();
    });
});

test("works with SecureStorage as underlying provider", async () => {
    const mono = new MonoStorage<BucketState, typeof key>(key, secureBase as any);

    await mono.set("a", 1);
    await mono.set("c", "sec");

    expect(await mono.get("a")).toBe(1);
    expect(await mono.get("c")).toBe("sec");

    const raw = await (global as any).storageLocalGet(key, secureBase);
    expect(typeof raw).toBe("string");

    const decryptedAll = await secureBase.getAll();
    expect(decryptedAll[key]).toEqual({a: 1, c: "sec"});
});
