import _ from "lodash";
import {Configuration as RspackConfig} from "@rspack/core";

import {definePlugin} from "@main/plugin";
import {DiagnosticPlugin, GenerateJsonPlugin, type GenerateJsonPluginData, VirtualDataPlugin} from "@cli/bundler";
import {extractLocaleKey, modifyLocaleMessageKey} from "@locale/utils";

import Locale from "./Locale";

import {LocaleDeclaration} from "./declaration";

import {isWatchCommand} from "@typing/app";
import {Browser} from "@typing/browser";

const LOCALE_SLOT = "locale";

export default definePlugin(() => {
    let locale: Locale;
    let declaration: LocaleDeclaration;

    // Set by the `manifest` hook when it degrades a bad locale in dev; surfaced to the compilation
    // by the DiagnosticPlugin added in the `bundler` hook, so the error is never silently swallowed.
    let manifestError: Error | undefined;

    return {
        name: "adnbn:locale",
        topology: () => ({
            // Locale data now lives in a virtual module (see bundler hook), so its CONTENT no longer
            // belongs in the snapshot — a key/language edit rides the incremental recompile, not a
            // restart. Only the module's (constant) identity is reported.
            virtualModules: [
                {
                    request: VirtualDataPlugin.storageName(LOCALE_SLOT),
                    sourceFile: VirtualDataPlugin.specifier(LOCALE_SLOT),
                },
            ],
        }),
        startup: ({config}) => {
            locale = new Locale(config);
            declaration = new LocaleDeclaration(config);
        },
        locale: () => locale.files(),
        bundler: async ({config}) => {
            const watch = isWatchCommand(config.command);

            let jsonData: GenerateJsonPluginData = {};
            let keys: string[] = [];
            let locales: string[] = [];

            try {
                await locale.validate();

                declaration.structure(await locale.structure()).build();

                jsonData = await locale.json();
                keys = [...(await locale.keys())];
                locales = [...(await locale.languages())];
            } catch (e) {
                // A bad locale must fail the production build; under dev/watch degrade to empty so
                // discovery (the snapshot) survives a bad edit — the running compiler's data plugins
                // (below) surface the error and keep last-known-good data.
                if (!watch) {
                    throw e;
                }
            }

            const json = new GenerateJsonPlugin(jsonData);

            // defaultLanguage lets the runtime (NativeLocale) fall back to the configured locale
            // when the i18n marker is unavailable (e.g. before the extension is reloaded), instead
            // of crashing the view. It's known regardless of whether locale files exist yet.
            const data = new VirtualDataPlugin(LOCALE_SLOT, {keys, locales, defaultLanguage: config.lang});

            if (watch) {
                json.watch(async () => {
                    locale.clear();

                    await locale.validate();

                    declaration.structure(await locale.structure()).build();

                    return await locale.json();
                });

                // Candidate locale dirs come from the finder regardless of whether files exist yet,
                // so creating the FIRST locales/*.yaml in a project that started with none is still
                // watched (snapshot no longer changes for locale, so there is no restart to fall back on).
                const files = Array.from(await locale.plugin().files(), file => file.file);
                const dirs = locale.directories();

                data.watch({
                    update: async () => {
                        locale.clear();

                        await locale.validate();

                        return {
                            keys: [...(await locale.keys())],
                            locales: [...(await locale.languages())],
                            defaultLanguage: config.lang,
                        };
                    },
                    files,
                    dirs,
                });
            }

            return {
                plugins: [json, data, new DiagnosticPlugin(() => manifestError)],
                resolve: {alias: data.alias()},
            } satisfies RspackConfig;
        },
        manifest: async ({config, manifest}) => {
            manifestError = undefined;

            try {
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
            } catch (e) {
                // Build: an invalid locale/config must fail. Dev/watch: the manifest is rebuilt on
                // every recompile (via WatchPlugin), so the error must NOT fail that compilation —
                // degrade to a safe default name. But record it so the DiagnosticPlugin surfaces it
                // as a compilation error: some manifest errors (e.g. a name referencing a missing
                // locale key while the locale files are otherwise valid) are invisible to the
                // GenerateJsonPlugin/VirtualDataPlugin and would otherwise be silently swallowed.
                if (!isWatchCommand(config.command)) {
                    throw e;
                }

                manifestError = e instanceof Error ? e : new Error(String(e));

                manifest.setName(_.startCase(config.app));
            }
        },
    };
});
