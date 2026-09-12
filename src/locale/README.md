---
description: Runtime translation providers, shared formatting, catalogue access, and React integration.
---

# Locale

`src/locale` implements translation at runtime: message lookup, substitutions, plural forms, language selection, and UI integration. Its public entrypoints are `adnbn/locale` and `adnbn/locale/react`.

## Directory responsibilities

| Area                          | Responsibility                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `providers/AbstractLocale.ts` | Common string rendering, missing-message diagnostics, and language names.                                                     |
| `providers/NativeLocale.ts`   | Browser i18n message lookup and a singleton used by the public helpers.                                                       |
| `providers/DynamicLocale.ts`  | Compiled translations, language state per instance, and optional storage synchronization.                                     |
| `providers/CustomLocale.ts`   | Internal provider for an explicitly supplied language and flat message dictionary; not re-exported by the public entrypoint.  |
| `helpers.ts`                  | Native shortcuts: `t`, `choice`, `key` for browser message references, and `resolve` for strings prefixed with `@`.           |
| `catalogue/`                  | Empty package fallback and typing for the generated data module.                                                              |
| `storage/`                    | Built-in `LocaleStorage` implementation of the public `LocaleStorageDriver` contract.                                         |
| `adapters/react/`             | `LocaleProvider`, its context, and `useLocale`; connects dynamic localization to React state and DOM `lang`/`dir` attributes. |
| `index.ts`                    | Public providers, helpers, and selected shared contracts.                                                                     |

## Ownership and data flow

Shared languages and contracts belong to `src/types/locale.ts`. It also declares the empty `LocaleRegistry`, re-exported through `adnbn/locale`. Generated `.adnbn/locale.d.ts` augments that registry, defining the application's keys and required substitutions from its default language for providers, helpers, and adapters. The private module name and bundler layer belong to `src/cli/plugins/locale/module.ts`.

Locale discovery, merging, validation, fallback preparation, native `_locales/*/messages.json`, and declaration generation belong to the CLI locale pipeline. The locale feature plugin supplies the generated data; Rspack integration and chunk delivery belong to the bundler.

In watch mode, one refresh prepares the locale data before the JSON and module generators read it. File and directory dependencies are refreshed on every rebuild, including newly added languages. Invalid edits produce compilation errors without replacing the last successful output; fixing the source allows the next rebuild to proceed.

Common algorithms live in `src/shared/locale`. Its `index.ts` re-exports the helpers; CLI, providers, and adapters import them from `@shared/locale`:

- `keys.ts`: key conversion and locale markers.
- `language.ts`: language resolution and text direction.
- `messages.ts`: flattening browser messages into a string dictionary and `getLocaleFilename` for native message paths.
- `plural.ts`: plural rules and form selection through `selectPluralForm`.
- `substitutions.ts`: `parsePlaceholders` finds placeholder names and positions; `applySubstitutions` inserts values into message parts, preserving their types.

These modules depend only on shared contracts and have no browser, DOM, React, storage, or CLI dependencies. Consumers supply missing-substitution diagnostics; React node rendering stays inside the React adapter.

During extension builds, the private `#adnbn/locale` import resolves directly to a generated module: a default catalogue export plus named `keys`, `languages`, and `lang` (the configured default language). `DynamicLocale` reads the catalogue; `NativeLocale` imports only the named lists, allowing unused translations to be removed from optimized bundles. Outside these builds, `catalogue/` provides a resolvable empty module with `lang: "en"`.

Views and ISOLATED content scripts can share `locale.js`. MAIN retains its own content layer: its catalogue stays in the entrypoint or joins `common-main.content.js` under the regular content chunk rules. Background keeps translations in its single bundle. This separates file delivery across content execution worlds; the same translations may occur in their respective bundles.

Core providers have no React dependency. Browser i18n access goes through `@addon-core/browser`; `DynamicLocale` delegates persistence to `LocaleStorageDriver`. The built-in `LocaleStorage` uses `@addon-core/storage`. Both native and dynamic providers determine their initial language from the browser's `locale` message. If that call fails or its marker cannot be resolved, `DynamicLocale` uses the generated `lang`. `NativeLocale` still requires browser i18n. The empty package fallback contains no translations; `DynamicLocale` requires a generated catalogue containing its selected language.

## Runtime behavior

Translations are synchronous strings. Providers share substitution and plural processing through `AbstractLocale`; `trans` handles non-plural keys and `choice` selects a form by count. Substitutions accept strings and numbers. Generated public keys use dot notation, while message lookup converts them to underscore keys. Missing messages warn and return the key; empty translations remain empty strings.

`DynamicLocale` reads bundled messages without fetching JSON or dynamically importing languages. `change()` updates its state immediately and returns a promise for saving the language code. Without a constructor argument it creates `LocaleStorage`, which uses extension local storage with the fixed namespace `PackageName` (`adnbn`) and default key `locale`. Pass another key to `new LocaleStorage("customLocale")`; the constructor stores it in the protected `key` property used for reading, writing, and watching. Passing `false` to `DynamicLocale` keeps state only in the instance; passing a `LocaleStorageDriver` uses that object directly.

In MAIN, use `new DynamicLocale(false)` or supply a custom driver that does not require extension APIs. Translations and language changes work from the bundle, starting with the configured default language. The built-in driver is intended for ISOLATED and extension pages.

Storage initialization is explicit: `sync()` reads the saved language, `watch()` observes subsequent storage events, and `unwatch()` disconnects. The constructor does neither. `watch()` is not a general subscription to in-memory state; `sync()` and `watch()` require enabled storage. The current React provider connects these methods on mount and exposes their results through context.

`LocaleStorageDriver` provides `get(): Promise<Language | undefined>`, `set(lang): Promise<void>`, and `watch(handler): () => void`. Reading an absent value leaves the current language unchanged. Notifications contain only valid language codes, including own writes, with no initial notification or deletion event. `LocaleStorage` ignores absent values and diagnoses malformed codes; `DynamicLocale` additionally checks that a language exists in its catalogue. Read and write errors propagate to callers. Custom drivers own their persistence and notifications; pass the same driver to providers that should share its state.
