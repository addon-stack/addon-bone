---
description: Runtime translation providers, shared formatting, catalogue access, and React integration.
---

# Locale

`src/locale` implements translation at runtime: message lookup, substitutions, plural forms, language selection, and UI integration. Its public entrypoints are `adnbn/locale` and `adnbn/locale/react`.

## Directory responsibilities

| Area                            | Responsibility                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `providers/AbstractLocale.ts`   | Common string rendering, missing-message diagnostics, and language names.                                                    |
| `providers/NativeLocale.ts`     | Browser i18n message lookup and a singleton used by the public helpers.                                                      |
| `providers/DynamicLocale.ts`    | Compiled translations, language state per instance, and optional storage synchronization.                                    |
| `providers/ObservableLocale.ts` | Observable dynamic state, immutable snapshots, shared instances, and subscription lifetimes.                                 |
| `providers/CustomLocale.ts`     | Internal provider for an explicitly supplied language and flat message dictionary; not re-exported by the public entrypoint. |
| `helpers.ts`                    | Native shortcuts: `t`, `choice`, `key` for browser message references, and `resolve` for strings prefixed with `@`.          |
| `catalogue/`                    | Empty package fallback and typing for the generated data module.                                                             |
| `storage/`                      | Built-in `LocaleStorage` implementation of the public `LocaleStorageDriver` contract.                                        |
| `adapters/react/`               | React node rendering, native and dynamic locale hooks, and DOM language attributes through `useLocaleAttributes`.            |
| `index.ts`                      | Public providers, helpers, and selected shared contracts.                                                                    |

React hooks and their tests live in `adapters/react/hooks/`. The adapter's `index.ts` re-exports the hooks through `adnbn/locale/react`.

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

Language information uses the same names throughout providers, snapshots, and React hooks:

| Meaning                                         | Provider / snapshot | React hook  |
| ----------------------------------------------- | ------------------- | ----------- |
| Selected language code                          | `lang()`            | `lang`      |
| Set of available language codes                 | `langs()`           | `langs`     |
| Map of available codes to native language names | `langNames()`       | `langNames` |

Providers, snapshots, and hooks expose `ReadonlySet<Language>` and `ReadonlyMap<Language, string>`. These TypeScript types allow reading and iteration without exposing mutation methods; the underlying collections remain ordinary sets and maps. In snapshots and hooks, both collections retain their identity across dynamic language changes; their contents and order match the provider. In a language selector, iterate `langs` and read each label with `langNames.get(code)`.

`DynamicLocale` reads bundled messages without fetching JSON or dynamically importing languages. `change()` updates its state immediately and returns a promise for saving the language code. Without a constructor argument it creates `LocaleStorage`, which uses extension local storage with the fixed namespace `PackageName` (`adnbn`) and default key `locale`. Pass another key to `new LocaleStorage("customLocale")`; the constructor stores it in the protected `key` property used for reading, writing, and watching. Passing `false` to `DynamicLocale` keeps state only in the instance; passing a `LocaleStorageDriver` uses that object directly.

`select(lang): Language` selects a language synchronously without saving it, while `change(lang)` also saves the selection when storage is enabled. An unavailable language makes `select` throw synchronously without changing state. If the selected language differs from the saved value, a later `sync()` or storage event received through `watch()` can replace the local selection.

`DynamicLocale.messages()` returns a read-only view of the completed dictionary for its current language. It uses underscore keys, includes the `locale` marker and prepared fallbacks, and keeps placeholders and plural forms unrendered. Repeated reads reuse the dictionary; switching languages selects another dictionary without modifying previously returned data. This class-specific method does not extend the shared `LocaleProvider` contract.

In MAIN, use `new DynamicLocale(false)` or supply a custom driver that does not require extension APIs. Translations and language changes work from the bundle, starting with the configured default language. The built-in driver is intended for ISOLATED and extension pages.

Storage initialization is explicit: `sync()` reads the saved language, `watch()` observes subsequent storage events, and `unwatch()` disconnects. The constructor does neither. `watch()` is not a general subscription to in-memory state; `sync()` and `watch()` require enabled storage.

`LocaleStorageDriver` provides `get(): Promise<Language | undefined>`, `set(lang): Promise<void>`, and `watch(handler): () => void`. Reading an absent value leaves the current language unchanged. Notifications contain only valid language codes, including own writes, with no initial notification or deletion event. `LocaleStorage` ignores absent values and diagnoses malformed codes; `DynamicLocale` additionally checks that a language exists in its catalogue. Read and write errors propagate to callers. Custom drivers own their persistence and notifications; pass the same driver to providers that should share its state.

## Native translations in React

`useNativeLocale()` from `adnbn/locale/react` uses the existing `NativeLocale` singleton without a Provider or storage. It returns `LocaleReactContract`: `t`, `choice`, `lang`, `langs`, `langNames`, `dir`, and `isRtl`. Its language is selected by browser i18n, independently of dynamic language changes. It has no `change` method and requires browser i18n, just like the native helpers.

```tsx
import {useNativeLocale} from "adnbn/locale/react";

function Greeting() {
    const {t, choice} = useNativeLocale();
    const title = t("greeting", {name: "Ada"});

    return (
        <section title={title}>
            {t("greeting", {name: <strong>Ada</strong>})}
            {choice("items", 2, {count: <span>2</span>})}
        </section>
    );
}
```

For messages such as `"Hello {{name}}"` and `["{{count}} item", "{{count}} items"]`, string/number substitutions return strings; React substitutions return `ReactNode`. The generated registry checks keys, required placeholder names, and plural usage in both overloads. Numeric `count` selects the plural form before substitutions, independently of the displayed node.

The internal `ReactLocale` class implements `LocaleReactContract` by wrapping an existing message provider. The hook memoizes its instance; `t` and `choice` are bound to that instance so they can be destructured. The class owns React rendering, while the underlying provider owns message lookup.

The renderer inserts nodes directly and keeps component state, handlers, and refs. It supports repeated placeholders, trims names, and leaves empty or malformed placeholders as text. HTML in translations remains text. The React types and renderer belong to the adapter; the core provider contract continues to accept strings and numbers only.

## Observable dynamic translations

`ObservableLocale` implements `LocaleDynamicProvider` and delegates message lookup, string translation, plural forms, keys, and language information to a private `DynamicLocale(false)`. It owns storage, subscriptions, and language changes; the internal provider performs no storage operations. Its `lang()`, `langs()`, `langNames()`, `keys()`, `get()`, `trans()`, and `choice()` methods read the current language.

`snapshot()` and `subscribe(listener)` expose the observable state. A snapshot fixes the language and its message access, so translations retained from an earlier render stay consistent. Its `lang()`, `langs()`, `langNames()`, and `get(key)` methods are read-only; `get` returns the message before substitutions. The snapshot retains its identity until the language changes and uses a separate `CustomLocale` reader over the dictionary returned by `DynamicLocale.messages()`, without copying translations. Snapshot creation belongs to `ObservableLocale`; access to the generated catalogue stays inside `DynamicLocale`.

`new ObservableLocale(storage)` creates an independent instance. `ObservableLocale.getInstance()` shares the default storage instance; `getInstance(false)` shares a separate in-memory instance. Passing the same driver object returns the same instance. Different drivers remain separate, even when their underlying storage synchronizes them. Keep custom drivers stable across renders, for example by creating them outside the component.

Construction does not read or watch storage. The first subscriber connects one storage listener and reads the saved language. The last unsubscribe disconnects it, and reconnecting reads storage again. Each `subscribe()` call returns its own cleanup function; subscriptions also work with `false`. Explicit `sync()` reads the saved language and requires enabled storage.

`change()` publishes immediately and serializes persistence, including repeated selections of the current language. Old reads and storage echoes cannot overwrite a pending local selection. After successful writes, the provider reconciles with current storage. Save failures reject the returned promise without rolling back the selected language. Errors from automatic synchronization are logged; explicit `sync()` errors propagate to its caller.

## Dynamic translations in React

`useLocale(storage?)` returns `LocaleReactDynamicContract`, extending the native React translation contract with `change(lang): Promise<Language>`. It connects the shared `ObservableLocale` through React's `useSyncExternalStore`. Components using the same instance update together on local selections and storage changes. The hook renders immediately using the initial language, then restores a saved selection asynchronously. It does not modify DOM attributes.

```tsx
import {Language} from "adnbn/locale";
import {useLocale} from "adnbn/locale/react";

function Greeting() {
    const {t, lang, dir, change} = useLocale();
    return (
        <section lang={lang} dir={dir}>
            <p>{t("greeting", {name: <strong>Ada</strong>})}</p>
            <button
                onClick={() => {
                    change(Language.French).catch(console.error);
                }}
            >
                Français
            </button>
        </section>
    );
}
```

Pass `false` for memory or a `LocaleStorageDriver` for custom persistence. In MAIN world use one of these modes. Native translations from `useNativeLocale()` remain tied to browser i18n, independently of this dynamic selection. `useLocale` is intended for client-rendered extension interfaces; it does not supply a server snapshot for SSR.

## DOM language attributes

`useLocaleAttributes(locale, target?)` from `adnbn/locale/react` applies `lang` and `dir` in an effect. Pass the result of either `useLocale()` or `useNativeLocale()`; the hook only reads those two properties and creates no locale instance or storage subscription.

An omitted target or `undefined` selects `html`. A selector string selects the first matching element, an `Element` is used directly, and `null` disables application. For a content script, target the extension's container to leave the host page's language unchanged.

```tsx title="src/popup/App.tsx"
import {useLocale, useLocaleAttributes} from "adnbn/locale/react";

export function App() {
    const locale = useLocale();
    useLocaleAttributes(locale);

    return <main>{locale.langNames.get(locale.lang)}</main>;
}
```

Use `useNativeLocale()` in the same pattern for browser-selected localization. To toggle application while keeping the hook mounted, pass `enabled ? "#extension-root" : null` as the target.

Language, direction, or target changes rerun the effect. Before reapplying and on unmount, cleanup restores each previous attribute only if its current value still equals the value written by the hook. Previously absent attributes are removed. Use one attributes hook per target. Missing elements are skipped; no `MutationObserver` waits for them to appear, so the selector is checked again only when an effect dependency changes.

## React installation

React adapters require React and ReactDOM 18 or 19; `useLocale` uses the built-in `useSyncExternalStore`. React, ReactDOM, and their type packages are optional peers of `adnbn`. React projects should install them explicitly. No `use-sync-external-store` shim is required. The current external `@addon-core/storage` package still declares React as a required peer, so it may bring React into an otherwise non-React installation transitively.
