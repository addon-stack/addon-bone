import {getLocaleFilename} from "@locale/utils";

import {LocaleFinder} from "@cli/entrypoint";
import {GenerateJsonPluginData} from "@cli/bundler";

export default class extends LocaleFinder {
    public async json(): Promise<GenerateJsonPluginData> {
        await this.validate();

        const data: GenerateJsonPluginData = {};

        const builders = await this.builders();
        const defaultBuilder = this.getValidator().getDefaultBuilder(builders);
        const defaultMessages = defaultBuilder?.build() ?? {};

        for (const builder of builders.values()) {
            // Builders already include this app's layers and browser overrides.
            // Every target plural has been validated; only ordinary gaps remain.
            const messages = builder === defaultBuilder ? defaultMessages : builder.build();
            data[getLocaleFilename(builder.lang())] = {...defaultMessages, ...messages};
        }

        return data;
    }
}
