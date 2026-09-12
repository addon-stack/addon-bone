import {LocaleFinder} from "@cli/entrypoint";
import {GenerateJsonPluginData} from "@cli/bundler";

import {flattenLocaleMessages, getLocaleFilename} from "@shared/locale";

import type {Language, LocaleCatalogue, LocaleMessages} from "@typing/locale";

export default class Locale extends LocaleFinder {
    private _messages?: Promise<Map<Language, LocaleMessages>>;

    public async json(): Promise<GenerateJsonPluginData> {
        return Object.fromEntries(
            [...(await this.messages())].map(([lang, messages]) => [getLocaleFilename(lang), messages])
        );
    }

    public async catalogue(): Promise<LocaleCatalogue> {
        return Object.fromEntries(
            [...(await this.messages())].map(([lang, messages]) => [lang, flattenLocaleMessages(messages)])
        );
    }

    private messages(): Promise<Map<Language, LocaleMessages>> {
        return (this._messages ??= this.createMessages());
    }

    private async createMessages(): Promise<Map<Language, LocaleMessages>> {
        await this.validate();

        const data = new Map<Language, LocaleMessages>();

        const builders = await this.builders();
        const defaultBuilder = this.getValidator().getDefaultBuilder(builders);
        const defaultMessages = defaultBuilder?.build() ?? {};

        for (const builder of builders.values()) {
            // Builders already include this app's layers and browser overrides.
            // Every target plural has been validated; only ordinary gaps remain.
            const messages = builder === defaultBuilder ? defaultMessages : builder.build();

            data.set(builder.lang(), {...defaultMessages, ...messages});
        }

        return data;
    }

    public clear(): this {
        this._messages = undefined;

        return super.clear();
    }
}
