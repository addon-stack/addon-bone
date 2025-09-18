import AbstractStorage, {StorageOptions} from "./AbstractStorage";

import {StorageState, StorageWatchOptions} from "@typing/storage";

type StorageChange = chrome.storage.StorageChange;

export default class Storage<T extends StorageState> extends AbstractStorage<T> {
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

    protected async handleChange<P extends T>(
        key: string,
        changes: StorageChange,
        options: StorageWatchOptions<P>
    ): Promise<void> {
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
