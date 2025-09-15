import {browser, throwRuntimeError} from "@adnbn/browser";

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
    ): void;

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

    public async getAll<P extends T>(): Promise<P> {
        return new Promise((resolve, reject) => {
            this.storage.get(null, result => {
                try {
                    throwRuntimeError();

                    const formattedResult = {} as P;

                    for (const [key, value] of Object.entries(result)) {
                        if (this.isKeyValid(key)) {
                            formattedResult[this.getOriginalKey(key)] = value;
                        }
                    }

                    resolve(formattedResult);
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
