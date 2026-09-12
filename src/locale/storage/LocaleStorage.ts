import {Storage} from "@addon-core/storage";

import {PackageName} from "@typing/app";
import {Language, LanguageCodes, type LocaleStorageDriver} from "@typing/locale";

/** Stores the selected language in extension local storage under the framework namespace. */
export default class LocaleStorage implements LocaleStorageDriver {
    private readonly storage = Storage.Local<Record<string, Language>>({namespace: PackageName});

    constructor(protected key: string = "locale") {}

    public async get(): Promise<Language | undefined> {
        return this.parse(await this.storage.get(this.key));
    }

    public set(lang: Language): Promise<void> {
        return this.storage.set(this.key, lang);
    }

    public watch(handler: (lang: Language) => void): () => void {
        return this.storage.watch({
            [this.key]: value => {
                const lang = this.parse(value);

                if (lang !== undefined) {
                    handler(lang);
                }
            },
        });
    }

    private parse(value: unknown): Language | undefined {
        if (value === undefined) {
            return undefined;
        }

        if (typeof value === "string" && LanguageCodes.has(value)) {
            return value as Language;
        }

        console.warn("[LocaleStorage] Invalid language code in storage:", value);

        return undefined;
    }
}
