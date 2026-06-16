import _ from "lodash";
import {Configuration as RspackConfig, DefinePlugin} from "@rspack/core";

import {definePlugin} from "@main/plugin";
import {GenerateJsonPlugin} from "@cli/bundler";
import {extractLocaleKey, modifyLocaleMessageKey} from "@locale/utils";

import Locale from "./Locale";

import {LocaleDeclaration} from "./declaration";

import {isWatchCommand} from "@typing/app";
import {Browser} from "@typing/browser";

export default definePlugin(() => {
    let locale: Locale;
    let declaration: LocaleDeclaration;

    return {
        name: "adnbn:locale",
        startup: ({config}) => {
            locale = new Locale(config);
            declaration = new LocaleDeclaration(config);
        },
        locale: () => locale.files(),
        bundler: async ({config}) => {
            await locale.validate();

            declaration.structure(await locale.structure()).build();

            const plugin = new GenerateJsonPlugin(await locale.json());

            if (isWatchCommand(config.command)) {
                plugin.watch(async () => {
                    locale.clear();

                    await locale.validate();

                    declaration.structure(await locale.structure()).build();

                    return await locale.json();
                });
            }

            return {
                plugins: [
                    plugin,
                    new DefinePlugin({
                        __ADNBN_LOCALE_KEYS__: JSON.stringify([...(await locale.keys())]),
                        __ADNBN_DEFINED_LOCALES__: JSON.stringify([...(await locale.languages())]),
                    }),
                ],
            } satisfies RspackConfig;
        },
        manifest: async ({config, manifest}) => {
            const {lang: language, name, shortName, description, browser} = config;
            const availableLanguages = await locale.languages();
            const builders = await locale.builders();
            const hasLocales = builders.size > 0;

            if (availableLanguages.size > 0 && !availableLanguages.has(language)) {
                throw new Error(
                    `Language "${language}" not found in available translations. Available languages: ${[...availableLanguages].join(", ")}`
                );
            }

            await locale.validate();

            const keys = await locale.keys();

            const assertLocaleKey = (value: string, label: string): void => {
                const key = extractLocaleKey(value);

                if (!key) {
                    return;
                }

                if (!hasLocales) {
                    throw new Error(`Locale ${label} key "${key}" provided but no translations were found`);
                }

                if (!keys.has(key)) {
                    throw new Error(`Locale ${label} key "${key}" not found in translation`);
                }
            };

            manifest.setLocale(hasLocales ? language : undefined);

            if (shortName) {
                let manifestShortName = modifyLocaleMessageKey(shortName) ?? shortName;
                const shortNameKey = extractLocaleKey(shortName);

                assertLocaleKey(shortName, "short name");

                /** Opera/Edge do not support localization in manifest's short_name field */
                if (shortNameKey && (browser === Browser.Opera || browser === Browser.Edge)) {
                    const instance = builders.get(language);

                    if (!instance) {
                        throw new Error(`Locale not found for "${language}"`);
                    }

                    manifestShortName = instance.get().get(shortNameKey) ?? manifestShortName;
                }

                manifest.setShortName(manifestShortName);
            }

            if (description) {
                assertLocaleKey(description, "description");
                manifest.setDescription(modifyLocaleMessageKey(description));
            }

            if (name) {
                assertLocaleKey(name, "name");

                const manifestName = modifyLocaleMessageKey(name);

                if (manifestName) {
                    manifest.setName(manifestName);

                    return;
                }
            }

            manifest.setName(_.startCase(config.app));
        },
    };
});
