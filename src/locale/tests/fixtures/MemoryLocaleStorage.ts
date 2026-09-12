import type {Language, LocaleStorageDriver} from "@typing/locale";

export default class MemoryLocaleStorage implements LocaleStorageDriver {
    private readonly listeners = new Set<(lang: Language) => void>();

    constructor(public value?: Language) {}

    public get listenerCount(): number {
        return this.listeners.size;
    }

    public async get(): Promise<Language | undefined> {
        return this.value;
    }

    public async set(lang: Language): Promise<void> {
        this.value = lang;
        this.emit(lang);
    }

    public emit(lang: Language): void {
        for (const listener of this.listeners) listener(lang);
    }

    public watch(handler: (lang: Language) => void): () => void {
        this.listeners.add(handler);
        return () => {
            this.listeners.delete(handler);
        };
    }
}
