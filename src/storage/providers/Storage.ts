import AbstractStorage, {StorageOptions} from "./AbstractStorage";

import {StorageProvider, StorageState, StorageWatchOptions} from "@typing/storage";
import MonoStorage from "./MonoStorage";

type StorageChange = chrome.storage.StorageChange;

export interface StorageFactoryOptions extends StorageOptions {
    key?: string;
}

export default class Storage<T extends StorageState> extends AbstractStorage<T> {
    public static make<T extends StorageState>(options: StorageFactoryOptions = {}): StorageProvider<T> {
        const {key, ...storageOptions} = options;

        const storage = new Storage<T>(storageOptions);

        if (key) {
            return new MonoStorage(key, storage as StorageProvider<Record<typeof key, Partial<T>>>);
        }

        return storage;
    }

    public static Sync<T extends StorageState>(options?: Omit<StorageFactoryOptions, "area">): StorageProvider<T> {
        return Storage.make({...(options || {}), area: "sync"});
    }

    public static Local<T extends StorageState>(options?: Omit<StorageFactoryOptions, "area">): StorageProvider<T> {
        return Storage.make({...(options || {}), area: "local"});
    }

    public static Session<T extends StorageState>(options?: Omit<StorageFactoryOptions, "area">): StorageProvider<T> {
        return Storage.make({...(options || {}), area: "session"});
    }

    public static Managed<T extends StorageState>(options?: Omit<StorageFactoryOptions, "area">): StorageProvider<T> {
        return Storage.make({...(options || {}), area: "managed"});
    }

    constructor(options: StorageOptions = {}) {
        super(options);
    }

    public async clear(): Promise<void> {
        const allValues = await this.getAll();

        await this.remove(Object.keys(allValues));
    }

    protected isKeyValid(key: string): boolean {
        if (!super.isKeyValid(key)) return false;

        const parts = key.split(this.separator);

        return parts.length === 1 || (parts.length === 2 && parts[0] === this.namespace);
    }

    protected async handleChange<P extends T>(key: string, changes: StorageChange, options: StorageWatchOptions<P>) {
        await this.triggerChange(key, changes, options);
    }

    protected getFullKey(key: keyof T): string {
        return this.namespace ? `${this.namespace}${this.separator}${key.toString()}` : key.toString();
    }

    protected getNamespaceOfKey(key: string): string | undefined {
        const fullKeyParts = key.split(this.separator);
        return fullKeyParts.length === 2 ? fullKeyParts[0] : undefined;
    }
}
