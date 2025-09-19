import {browser, throwRuntimeError} from "@adnbn/browser";

import MonoStorage from "./MonoStorage";

import {StorageProvider, StorageState, StorageWatchOptions} from "@typing/storage";

const storage = () => browser().storage as typeof chrome.storage;

type AreaName = chrome.storage.AreaName;
type StorageArea = chrome.storage.StorageArea;
type StorageChange = chrome.storage.StorageChange;
type onChangedListener = Parameters<typeof chrome.storage.onChanged.addListener>[0];

export interface StorageOptions {
    area?: AreaName;
    namespace?: string;
}

type CtorOptions<C> = C extends new (options?: infer O) => any ? O : never;

type WithKey<T> = undefined extends T ? (Exclude<T, undefined> & {key?: string}) | undefined : T & {key?: string};

type OmitUndef<T, K extends PropertyKey> = undefined extends T
    ? Omit<Exclude<T, undefined>, K> | undefined
    : Omit<T, K>;

type FactoryOptions<T> = WithKey<CtorOptions<T>>;

type AreaOptions<T> = OmitUndef<FactoryOptions<T>, "area">;

type StaticMake<S extends StorageState, O extends StorageOptions> = <T extends new (options?: O) => StorageProvider<S>>(
    this: T,
    options?: FactoryOptions<T>
) => StorageProvider<S>;

export default abstract class AbstractStorage<T extends StorageState> implements StorageProvider<T> {
    private storage: StorageArea;
    private readonly area: AreaName;
    protected readonly namespace?: string;
    protected separator: string = ":";

    public abstract clear(): Promise<void>;

    protected abstract getFullKey(key: keyof T): string;

    protected abstract getNamespaceOfKey(key: string): string | undefined;

    protected abstract handleChange<P extends T>(
        key: string,
        changes: StorageChange,
        options: StorageWatchOptions<P>
    ): Promise<void>;

    public static make<
        S extends StorageState,
        O extends StorageOptions = StorageOptions,
        T extends new (options?: O) => StorageProvider<S> = new (options?: O) => StorageProvider<S>,
    >(this: T, options?: FactoryOptions<T>): StorageProvider<S> {
        const {key, ...rest} = options || {};

        const storage = new this(rest as O);

        if (typeof key === "string" && key.trim() !== "") {
            return new MonoStorage<S, typeof key>(key, storage as StorageProvider<Record<typeof key, Partial<S>>>);
        }

        return storage;
    }

    public static Local<
        S extends StorageState,
        O extends StorageOptions = StorageOptions,
        T extends new (options?: O) => StorageProvider<S> = new (options?: O) => StorageProvider<S>,
    >(this: T & {make: StaticMake<S, O>}, options?: AreaOptions<T>): StorageProvider<S> {
        return this.make({
            ...(options || {}),
            area: "local",
        } as FactoryOptions<T>);
    }

    public static Session<
        S extends StorageState,
        O extends StorageOptions,
        T extends new (options?: O) => StorageProvider<S>,
    >(this: T & {make: StaticMake<S, O>}, options?: AreaOptions<T>): StorageProvider<S> {
        return this.make({
            ...(options || {}),
            area: "session",
        } as FactoryOptions<T>);
    }

    public static Sync<
        S extends StorageState,
        O extends StorageOptions = StorageOptions,
        T extends new (options?: O) => StorageProvider<S> = new (options?: O) => StorageProvider<S>,
    >(this: T & {make: StaticMake<S, O>}, options?: AreaOptions<T>): StorageProvider<S> {
        return this.make({
            ...(options || {}),
            area: "sync",
        } as FactoryOptions<T>);
    }

    public static Managed<
        S extends StorageState,
        O extends StorageOptions = StorageOptions,
        T extends new (options?: O) => StorageProvider<S> = new (options?: O) => StorageProvider<S>,
    >(this: T & {make: StaticMake<S, O>}, options?: AreaOptions<T>): StorageProvider<S> {
        return this.make({
            ...(options || {}),
            area: "managed",
        } as FactoryOptions<T>);
    }

    protected constructor({area, namespace}: StorageOptions = {}) {
        this.area = area ?? "local";
        this.storage = storage()[this.area];
        this.namespace = namespace?.trim() ? namespace?.trim() : undefined;
    }

    public async set<K extends keyof T>(key: K, value: T[K]): Promise<void> {
        return new Promise((resolve, reject) => {
            this.storage.set({[this.getFullKey(key)]: value}, () => {
                try {
                    throwRuntimeError();
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    public async get<K extends keyof T>(key: K): Promise<T[K] | undefined> {
        const fullKey = this.getFullKey(key);

        return new Promise((resolve, reject) => {
            this.storage.get(fullKey, result => {
                try {
                    throwRuntimeError();
                    resolve(result[fullKey]);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    public async getAll(): Promise<Partial<T>> {
        return new Promise((resolve, reject) => {
            this.storage.get(null, result => {
                try {
                    throwRuntimeError();

                    const formattedResult: Partial<Record<keyof T, T[keyof T]>> = {};

                    for (const [key, value] of Object.entries(result)) {
                        if (this.isKeyValid(key)) {
                            const original = this.getOriginalKey(key) as keyof T;
                            formattedResult[original] = value as T[keyof T];
                        }
                    }

                    resolve(formattedResult as Partial<T>);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    public async remove<K extends keyof T>(keys: K | K[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const fullKeys = Array.isArray(keys) ? keys.map(key => this.getFullKey(key)) : this.getFullKey(keys);

            this.storage.remove(fullKeys, () => {
                try {
                    throwRuntimeError();
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    public watch<P extends T>(options: StorageWatchOptions<P>): () => void {
        const listener: onChangedListener = (changes: Record<string, StorageChange>, area: AreaName) => {
            if (area !== this.area) return;

            Object.entries(changes).forEach(async ([key, change]) => {
                if (this.isKeyValid(key)) {
                    this.handleChange(key, change, options);
                }
            });
        };

        storage().onChanged.addListener(listener);

        return () => storage().onChanged.removeListener(listener);
    }

    protected isKeyValid(key: string): boolean {
        return this.getNamespaceOfKey(key) === this.namespace;
    }

    protected async triggerChange<P extends T>(key: string, changes: StorageChange, options: StorageWatchOptions<P>) {
        const {newValue, oldValue} = changes;

        const originalKey = this.getOriginalKey(key);

        if (typeof options === "function") {
            options(newValue, oldValue);
        } else if (options[originalKey]) {
            options[originalKey]?.(newValue, oldValue);
        }
    }

    protected getOriginalKey(key: string): keyof T {
        const fullKeyParts = key.split(this.separator);

        return fullKeyParts.length > 1 ? fullKeyParts[fullKeyParts.length - 1] : key;
    }
}
