# Changelog

## 🚀 Release `adnbn` v0.7.0 (2026-05-25)


### ✨ Features

* **csp:** add CSP builder layer for extension entrypoints ([66a7e77](https://github.com/addon-stack/addon-bone/commit/66a7e775d3096a03f9f71edd02bd6d9e3ca466f8))

  - Add typed CSP configs for view entrypoints and sandbox pages
  - Merge per-entrypoint CSP options into MV2 and MV3 manifest output
  - Wire page, popup, sidebar, and offscreen CSP into extension-pages CSP
  - Keep sandbox CSP generation browser-aware
  - Cover CSP builders and manifest merge behavior with tests

* **manifest:** add sandbox and content security policy support for MV2 and MV3 ([2fb3e62](https://github.com/addon-stack/addon-bone/commit/2fb3e624f525ff54067c427205460ac4eda4cd3d))

  - Add `addSandbox`, `appendSandboxes`, and `setSandboxContentSecurityPolicy` methods
  - Implement builders for sandbox pages and content security policies in MV2 and MV3
  - Update tests for manifest sandbox functionality

* **sandbox:** introduce sandbox message system and host/iframe communication support ([7350888](https://github.com/addon-stack/addon-bone/commit/73508888a817844bb724877347d2ed501d9d4353))

  - Add `SandboxMessage`, `SandboxHost`, `SandboxInner`, and `SandboxMemory` classes.
  - Implement in-memory and iframe-based sandbox communication.
  - Add `ReadyFrame` utility for iframe readiness handling.
  - Extend tests to cover sandbox message system, frame initialization, and transport.



### 🐛 Bug Fixed

* **page:** add sandbox entrypoint support to PageFinder ([8de9e0a](https://github.com/addon-stack/addon-bone/commit/8de9e0af9696fe85a70212029a72635fadb357c2))


* **style:** add support for merging Sass and CSS with PostCSS and improve style handling ([1db73c9](https://github.com/addon-stack/addon-bone/commit/1db73c9446ecfe36e6c675216c3fb63341c02c8a))




### 🧪 Tests

* add unit tests for locale validation and name generator refactor ([b7695da](https://github.com/addon-stack/addon-bone/commit/b7695da4480e70b65c71d7216141d77563596e00))




### 🧹 Chores

* enhance type handling and add multiline union alias support in tests ([2e385a1](https://github.com/addon-stack/addon-bone/commit/2e385a1eaa6a94206656bf4e928e11af03473d6d))




### 🛠️ Refactoring

* **csp:** add sandbox CSP support and integrate with view finders ([06f2a3b](https://github.com/addon-stack/addon-bone/commit/06f2a3b34aa2e0e7be310e96b540e46cc7b4c88a))

  - Implement `SandboxViewFinder` extending `ViewCspFinder` to handle sandbox CSPs.
  - Add `sandbox.ts` fixture to define sandbox CSP configurations.
  - Update `Sandbox` to fetch CSPs using view-based methods.
  - Adjust manifest to include sandbox CSPs via updated view logic.
  - Add tests to validate sandbox CSP collection and integration.

* **message:** extract error handling into dedicated utility module ([2ea2fb0](https://github.com/addon-stack/addon-bone/commit/2ea2fb05677e770dfaadecf4aaf5b9561d6fed37))

  - Move `serializeError` and `restoreError` from `MessageManager` to `error.ts`
  - Replace inline error handling with shared utility functions across the message layer
  - Add comprehensive tests for error serialization and restoration logic

* **transport:** refactor transport interfaces and add sandbox registry support ([26f8099](https://github.com/addon-stack/addon-bone/commit/26f80999f185dee7e6394678a4cc3f9bde2e6091))

  - Split `TransportMessage` into `TransportSender` and `TransportReceiver`
  - Add `TransportMessage` implementation combining sender and receiver
  - Introduce `TransportDeclarationLayer.Sandbox` and `sandbox.d.ts` handling
  - Implement `TransportBuilder` for sandbox transport initialization
  - Add `destroy` method and cleanup mechanism to `RegisterTransport`




### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 11

## 🚀 Release `adnbn` v0.6.1 (2026-05-19)


### 🐛 Bug Fixed

* **transport:** improve error handling and result structure across transports ([2dc9aca](https://github.com/addon-stack/addon-bone/commit/2dc9aca34cfca78c17ef89451db1f9f8c2e895e6))

  - Add structured error serialization and restoration in MessageManager
  - Add support for envelope-like response structures in messages
  - Improve test coverage for various error scenarios in message handlers
  - Refactor transport registries with stricter type constraints
  - Update transport APIs to use scoped registry names and target types




### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 2

## 🚀 Release `adnbn` v0.6.0 (2026-05-11)


### ⚡️ Performance Improvements

* **build:** enable separate TypeScript declaration file generation ([7864487](https://github.com/addon-stack/addon-bone/commit/7864487f8fde6d37282047fc19dde2f5d964e825))




### ✨ Features

* **config:** add `shared` option for configurable shared source layer ([0ff5c34](https://github.com/addon-stack/addon-bone/commit/0ff5c346623e5a1a402b08fcae9dc5c02b7abedf))

  - Introduced `shared` option to configure shared directories as `false`, `true`,
   or a custom string.
  - Added tests to validate behavior for all `shared` option cases.
  - Updated type definitions to document the new `shared` configuration.

* **offscreen:** add lifecycle tests and improve iframe readiness handling ([db39da2](https://github.com/addon-stack/addon-bone/commit/db39da29e7d66d41fa422e48c3c2a258d698089a))

  - Added tests to validate iframe lifecycle, including creation, readiness, and removal.
  - Improved offscreen iframe readiness by waiting for a specific "ready" message.
  - Updated timeout handling for iframe readiness and added error messaging.

* **workspace:** add workspace mode for single and multi app structure ([8469d92](https://github.com/addon-stack/addon-bone/commit/8469d92c52bf55abc27cdec74bfe47206370393b))

  - add Workspace enum with single and multi modes
  - replace shared config option with workspace
  - keep sharedDir as a public configurable directory
  - normalize sharedDir to "." for single workspace
  - use configured sharedDir for multi workspace
  - update config resolver tests for workspace behavior



### 🐛 Bug Fixed

* **command:** simplify error message for invalid command key options ([c02a4dd](https://github.com/addon-stack/addon-bone/commit/c02a4ddb06d8639817b44ed2924cc1f82539ae83))


* **locale:** validate locale contract and tighten substitutions ([d3b05a6](https://github.com/addon-stack/addon-bone/commit/d3b05a67d77a29987139f7ee984760269eaefd0a))

  - resolve config.lang to a concrete Language before plugins run
  - validate locale structure against the default language contract
  - allow missing keys in secondary locales and warn about extra keys
  - generate locale keys and types from the default language only
  - trim runtime substitution placeholders to match generated types
  - make substitution arguments strict in TypeScript
  - fix manifest plain name, shortName and description handling
  - replace locale helpers with t, choice, key and resolve
  - preserve empty-string values in custom and dynamic locales
  - add locale validator, manifest, runtime and type-level tests

* **parsers:** correct regex patterns for object type formatting in `SignatureBuilder` ([6acda7d](https://github.com/addon-stack/addon-bone/commit/6acda7daf7d26ab39643667991af5d5d61d2ffbb))


* **parsers:** exclude `this` parameter from signature generation ([1d5f3cd](https://github.com/addon-stack/addon-bone/commit/1d5f3cd99127f09b62a9cac9595c9f988ffa8c74))

  - Updated `SignatureBuilder` to filter out `this` parameters in method signatures.
  - Adjusted tests in `ExpressionFile` to reflect changes in method return type.
  - Refined type usage and formatting in service definition for consistency.

* **tests:** improve path normalization and add Windows-specific diagnostics test ([354f428](https://github.com/addon-stack/addon-bone/commit/354f42836f94a1d41a499d6703321052318281d4))


* **tests:** normalize paths in entrypoint and locale tests ([de0b494](https://github.com/addon-stack/addon-bone/commit/de0b49429ed201a7b2ad69359e4f57c4fd0f356f))




### 🧹 Chores

* **deps:** bump lodash to v4.18.1 ([209be45](https://github.com/addon-stack/addon-bone/commit/209be45ad7c1681d05fb18c466049320829f4513))


* **deps:** update `ts-node` to v10.9.2 and clean up outdated dependencies ([409bf0b](https://github.com/addon-stack/addon-bone/commit/409bf0bee800e62a4c23b657e1822a918f8f951a))


* **docs:** remove projects skills ([31c2407](https://github.com/addon-stack/addon-bone/commit/31c2407e9c3f9484ca46e5a75cfb13af4f02a35f))


* **manifest:** remove redundant comment in URL match validation logic ([2e095da](https://github.com/addon-stack/addon-bone/commit/2e095daadc23b6f1cea17dca6c3b8c6ba8ac365c))


* simplify documentation for `EntrypointOptions` by removing redundant notes ([7869818](https://github.com/addon-stack/addon-bone/commit/78698181e38d46bf5c7600b0a1cd7ec660e4517f))


* **tsconfig:** reformat include list and update exclude patterns ([1afe794](https://github.com/addon-stack/addon-bone/commit/1afe794eefe30def474bbb0afe6861c938889f86))




### 🛠️ Refactoring

* **command:** enhance shortcut key validation and add tests for CommandParser ([c0e9464](https://github.com/addon-stack/addon-bone/commit/c0e9464ff21fa428de2343b758e4184651ec6d89))

  - Refined shortcut key validation, supporting media and platform-specific keys.
  - Added stricter global shortcut constraints and error messaging improvements.
  - Introduced comprehensive tests to ensure robust validation logic.

* **finder:** improve sorting logic and enhance priority handling ([9c1dbcf](https://github.com/addon-stack/addon-bone/commit/9c1dbcf71ab99b70718694511c67814a800892bf))


* **finder:** restructure file collection logic to support grouped and root entrypoints ([4ae0c7b](https://github.com/addon-stack/addon-bone/commit/4ae0c7b0df98256557d2c765485427734ea0af1a))


* **Manifest:** add raw method to manifestBuilder, add plugin and manifest option to config ([491dc83](https://github.com/addon-stack/addon-bone/commit/491dc8357b5a2b2f07bdac21dd602796b19b1be6))


* **Manifest:** improve permissions and host permissions logic, improve raw manifest merging ([ddc543b](https://github.com/addon-stack/addon-bone/commit/ddc543bc8d96a0d5bed45942c45679d696f61dbf))


* **manifest:** streamline `combined*` methods for readability and maintainability ([83db7c1](https://github.com/addon-stack/addon-bone/commit/83db7c1979da8f91230c7be3381ad812edcf9db4))





### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 24
- [Rostyslav Nihrutsa](https://github.com/RostyslavNihrutsa) (@RostyslavNihrutsa) — commits: 2

## 🚀 Release `adnbn` v0.5.7 (2026-02-04)


### ⚡️ Performance Improvements

* **config:** extend `commonChunks` to support dynamic chunk naming functionality ([2bbd640](https://github.com/addon-stack/addon-bone/commit/2bbd6405a0a5be6346f0530b6476f8592892e058))


* **optimization:** enhance chunk splitting and export handling in plugin config ([24ee48b](https://github.com/addon-stack/addon-bone/commit/24ee48bf921618632cee118bd7e862b63b4b25ee))


* **plugins:** enhance chunk splitting logic with entry filtering and path resolution ([e376378](https://github.com/addon-stack/addon-bone/commit/e376378113e30224392ead24ccf40333b11df73b))




### 🐛 Bug Fixed

* **config:** simplify dotenv config by removing redundant environment variable settings ([35caec2](https://github.com/addon-stack/addon-bone/commit/35caec281830d1b090b5f8ecd2171a0a84f40d85))




### 🧹 Chores

* **deps:** update dependencies in `package-lock.json` to latest compatible versions ([1678839](https://github.com/addon-stack/addon-bone/commit/16788399f1f36c7bfa398aec7482e0ebb6ae055c))





### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 5
- [Addon Stack](https://github.com/addon-stack) (@addon-stack) — commits: 1

## 🚀 Release `adnbn` v0.5.6 (2026-01-28)


### 🐛 Bug Fixed

* extend permissions with BookmarksInfo and improve test coverage ([054a40c](https://github.com/addon-stack/addon-bone/commit/054a40cce7754ba4dd739a7b7ddc74c01d4390f6))





### 🙌 Contributors

- [Addon Stack](https://github.com/addon-stack) (@addon-stack) — commits: 1
- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 1

## 🚀 Release `adnbn` v0.5.5 (2026-01-28)


### ⚡️ Performance Improvements

* add support for data collection permissions in gecko-specific settings ([e69fa41](https://github.com/addon-stack/addon-bone/commit/e69fa41328b6db48f8300f998da4d9b04eeae689))




### 🤖 CI

* **release:** simplify npm config and pin npm version in workflow ([67c3a17](https://github.com/addon-stack/addon-bone/commit/67c3a17907b3418cae3808b6d0ef67f37df78ff5))





### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 2
- [Addon Stack](https://github.com/addon-stack) (@addon-stack) — commits: 1

## 🚀 Release `adnbn` v0.5.4 (2026-01-17)


### 🐛 Bug Fixed

* update repository url format for compatibility with npm standards ([d751d2b](https://github.com/addon-stack/addon-bone/commit/d751d2becc002c5df9ded4260958ecf5db22165d))




### 🤖 CI

* **release:** enhance npm publish config and enable provenance in workflow ([9bbae3e](https://github.com/addon-stack/addon-bone/commit/9bbae3e1d655afb7637b407d281be63d4686e8fa))


* **release:** skip npm checks and clean release workflow config ([f35fd05](https://github.com/addon-stack/addon-bone/commit/f35fd056f01ce6230d5ad1991186600701c7933f))


* **release:** update npm settings and workflow for registry and provenance handling ([8552c31](https://github.com/addon-stack/addon-bone/commit/8552c31ae8f3fc968dbb77d7218beb095b112ac5))


* **release:** update release config for npm provenance and registry handling ([20377c4](https://github.com/addon-stack/addon-bone/commit/20377c43307a6ab81b77a70c93a68ea8bd393a4e))


* remove unused auth tokens from release workflow ([1fbf28b](https://github.com/addon-stack/addon-bone/commit/1fbf28bcda15b39dfd96211a3001c2d93efb0b79))




### 🧹 Chores

* **deps:** update dependencies in package-lock.json for latest versions ([b3a1177](https://github.com/addon-stack/addon-bone/commit/b3a117755b3b6f2bda3fd5cf4d4851195800a030))


* **deps:** update package-lock to upgrade and align dependencies ([1954eb8](https://github.com/addon-stack/addon-bone/commit/1954eb87509fa6cc2b66ab4ab7cfeb8bb81cc16e))


* **types:** adjust interface formatting for consistency and readability ([7f08239](https://github.com/addon-stack/addon-bone/commit/7f08239e4efd1cf8cb4c33088026ebb501f911d2))




### 🛠️ Refactoring

* **locale:** add container prop for dynamic lang/dir attribute handling ([c409172](https://github.com/addon-stack/addon-bone/commit/c409172955a8080ddada7c030b50d086adeaa41f))


* **locale:** improve locale handling and language resolution logic ([71d0b1c](https://github.com/addon-stack/addon-bone/commit/71d0b1cdeb2e134f71555d3d25a8300136ee561b))

  - Renamed `normalizeLocale` to `resolveLanguage` for clarity.
  - Enhanced language detection logic with better fallback handling.
  - Added comprehensive comments to explain Chrome i18n locale detection limitations.
  - Improved error messages and logging for unsupported or failed locale resolutions.
  - Updated related imports and adjusted code for the `resolveLanguage` function.

* **Locale:** streamline language detection and normalization logic ([f420c38](https://github.com/addon-stack/addon-bone/commit/f420c38a32261a0eb07cc29278de3ce044a5ff17))





### 🙌 Contributors

- [Anjey Tsibylskij](https://github.com/atldays) (@atldays) — commits: 11
- [Addon Stack](https://github.com/addon-stack) (@addon-stack) — commits: 8
- [Rostyslav Nihrutsa](https://github.com/RostyslavNihrutsa) (@RostyslavNihrutsa) — commits: 1

## 🚀 Release `adnbn` v0.5.3 (2025-11-25)


### 🐛 Bug Fixed

* **config:** format `whatBump` logic for readability and maintainability ([90dc51d](https://github.com/addon-stack/addon-bone/commit/90dc51d4686770af9697e5693e1aacee577d2bb0))


* enhance release rules and bump logic for semantic versioning ([d99f6fc](https://github.com/addon-stack/addon-bone/commit/d99f6fcbd0f42d3e181c06ab10bb185a089ff7dd))




### 🧹 Chores

* **deps:** update `c12` and `@rsdoctor/rspack-plugin` to latest versions ([addae18](https://github.com/addon-stack/addon-bone/commit/addae18643c037d307f393f5a78348e3ba67b7be))


* **deps:** update package-lock to upgrade dependencies ([76e0b1e](https://github.com/addon-stack/addon-bone/commit/76e0b1e26442633899b8911f8f493dcf344b945b))




### 🛠️ Refactoring

* **config:** improve output, optimization, and style plugin configurations ([f0a07d5](https://github.com/addon-stack/addon-bone/commit/f0a07d5008569bf3b097f15d2c117f5842ae97c6))


* **content:** improve content manager handling and add comprehensive utils tests ([4cead1a](https://github.com/addon-stack/addon-bone/commit/4cead1adb3890ee672bc08097de0b9a165f39769))





### 🙌 Contributors

- [Addon Stack](https://github.com/addon-stack) (@addon-stack) — commits: 8

## 🚀 Release `adnbn` v0.5.2 (2025-11-10)


### 🐛 Bug Fixed

* **cli:** set default DOTENV_LOG level to 'error' instead of 'none' ([2ff78be](https://github.com/addon-stack/addon-bone/commit/2ff78bef7dd4919c459adaefc0d607727943e816))




### 🧹 Chores

* **plugins:** standardize plugin export names for consistency ([fc2cb55](https://github.com/addon-stack/addon-bone/commit/fc2cb554787523aec786ffc83700db20a2e6cb94))




### 🛠️ Refactoring

* **dotenv:** remove encryption/decryption logic and simplify env handling ([9af389f](https://github.com/addon-stack/addon-bone/commit/9af389fbba53457e32c32ee23b27cbb4cd92c834))

  - Deleted `crypt.ts` module and associated tests.
  - Removed references to encryption/decryption in dotenv utils and plugins.
  - Simplified `resolveEnvOptions` to eliminate `crypt` flag handling.
  - Updated tests to reflect the removal of encryption-related logic.
  - Renamed `ReservedEnvKeys` to `EnvReservedKeys` for consistency.

* **meta:** remove `Email` plugin and implement `SpecificSettings` plugin ([82db540](https://github.com/addon-stack/addon-bone/commit/82db540f1a5def467e6685ece71a0b0f22cd7d53))

  - Deleted `Email` metadata plugin and its associated tests.
  - Added `SpecificSettings` plugin to handle browser-specific configurations.
  - Updated manifest builder to support `browser_specific_settings` via `SpecificSettings`.
  - Enhanced typing schemas to include `BrowserSpecific` definitions.
  - Refactored related code and tests to incorporate new plugin and remove redundant logic.

## 🚀 Release `adnbn` v0.5.1 (2025-10-28)


### 🐛 Bug Fixed

* **Message:** remove unsupported `documentId` option in sendTabMessage for Firefox ([07a2599](https://github.com/addon-stack/addon-bone/commit/07a259996d5f55a4ca3d3c3de11683e630d98b56))




### 🧪 Tests

* **Message:** add `documentId` support in sendTabMessage with Firefox handling ([7d41a73](https://github.com/addon-stack/addon-bone/commit/7d41a73a0185322c4c523eaa7899d0be7a0c65cf))




### 🧹 Chores

* **deps:** remove unused `@types/validator` dependency from package.json ([c5745a5](https://github.com/addon-stack/addon-bone/commit/c5745a57be108941ff0c6e890a5f951a722f82da))

## 🚀 Release `adnbn` v0.5.0 (2025-10-22)


### ⚡️ Performance Improvements

* **content:** add processing lock mechanism with `await-lock` ([24a9395](https://github.com/addon-stack/addon-bone/commit/24a93951f621481803a003a0f3a95e4ba3844302))




### ✨ Features

* **content:** add `WeakMarker` implementation and integrate with content resolvers ([a35abd6](https://github.com/addon-stack/addon-bone/commit/a35abd697c233403282d161a820d8824340ff64a))

  - Introduced `WeakMarker` for managing weakly referenced element markers.
  - Updated `core.ts` to register `ContentScriptMarker` resolvers.
  - Enhanced `ContentParser` schema with `marker` validation support.
  - Integrated `WeakMarker` into `Builder` with necessary error handling.

* **content:** introduce marker-based anchor handling and cleanup resolvers ([bd7b897](https://github.com/addon-stack/addon-bone/commit/bd7b897cb131dddcf1197d3892d404aa7891eab7))

  - Added `ContentScriptMarkerContract` for marker management.
  - Replaced `contentScriptAnchorAttribute` with marker attribute logic.
  - Refactored `Node` and introduced `MarkerNode` wrapping for marker operations.
  - Abstracted marker logic into `AbstractMarker` and `AttributeMarker`.
  - Updated related definitions and resolved configurations for marker integration.

* **entrypoint:** add definition shorthand support and improve tests ([e29e3f9](https://github.com/addon-stack/addon-bone/commit/e29e3f9075c87a9ecccd94f9303db359166309a4))




### 🐛 Bug Fixed

* fix email mapping and update git shortlog command to use mailmap ([bdbd0b2](https://github.com/addon-stack/addon-bone/commit/bdbd0b28349b9e96c38beff0b367df2e16ef822e))




### 🧪 Tests

* **content:** add comprehensive test coverage for markers ([04572f4](https://github.com/addon-stack/addon-bone/commit/04572f4feb436577b3ee1a120fb1e83277971d19))

  - Added new unit tests for `WeakMarker`, `AttributeMarker`,
    and unified `Marker` tests.
  - Improved test specificity and coverage across different marker implementations.
  - Removed redundant tests and refactored existing ones for clarity.

* **content:** add unit tests for `AttributeMarker` functionality ([1977f8c](https://github.com/addon-stack/addon-bone/commit/1977f8c86d29fb4cc5a1a056dcb7dfeb8201505a))




### 🧹 Chores

* **deps:** update package-lock to upgrade dependencies ([92556a6](https://github.com/addon-stack/addon-bone/commit/92556a6c02df253000c93d6660b654179dd27463))


* **deps:** update package-lock to upgrade dependencies ([ee784b8](https://github.com/addon-stack/addon-bone/commit/ee784b802e411c8578aa90ae158c12fe7d19dcd9))




### 🛠️ Refactoring

* **content:** improve marker querying and unify unmarked handling ([d40c7e1](https://github.com/addon-stack/addon-bone/commit/d40c7e1fc1f6fcb4b019ba81f86fcd96c2c8754a))


* **content:** remove redundant marker type validation in `Builder` ([073e69c](https://github.com/addon-stack/addon-bone/commit/073e69c21f658172302b6cf5c3b73e3a50271853))


* **entrypoint:** enhance shorthand property type resolution and refactor methods ([d6316e9](https://github.com/addon-stack/addon-bone/commit/d6316e9f5fca308a12038c74a359ffef0371b612))

  - Implemented `resolveTypeFromShorthand` for cleaner and reusable logic.
  - Improved `SourceFile` handling for shorthand property assignments.
  - Moved background tests to a standalone file for better test structure.

* **icon:** update `getIcons` return type and migrate to `Map` usage ([b981cf5](https://github.com/addon-stack/addon-bone/commit/b981cf521b4b5f8b36639e0dba612a96489ad815))

## 🚀 Release `adnbn` v0.4.2 (2025-10-13)


### ⚡️ Performance Improvements

* **icon:** add support for updating the sidebar icon ([5080b50](https://github.com/addon-stack/addon-bone/commit/5080b50527053b9ee82b2468a6e807d168c7003f))


* **icon:** add support for updating the sidebar icon ([c5d8852](https://github.com/addon-stack/addon-bone/commit/c5d8852b25146d89443499e6f512881fb7d82fcc))




### 🐛 Bug Fixed

* **config:** add debug-based dotenv logging configuration ([cce9cc5](https://github.com/addon-stack/addon-bone/commit/cce9cc5238050d441138744a3b944f668a3aaa6d))




### 🧹 Chores

* **deps:** update dependencies and add overrides for package improvements ([84c783a](https://github.com/addon-stack/addon-bone/commit/84c783aa51b169b2d821429c397b2afd1eba611d))

  - Upgraded dependencies: `@types/node`, `caniuse-lite`, `glob`, `immutable`.
  - Updated `source-map` version and replaced duplicates with a single entry.
  - Added `overrides` section to ensure compatibility for `html-rspack-tags-plugin` and `tsup`.

* update dependencies and improve configuration ([08b551a](https://github.com/addon-stack/addon-bone/commit/08b551a935312f35f3e7d9f8f7a1d09874b8ac21))


* update dependencies in `package-lock.json` to newer versions ([81db4e1](https://github.com/addon-stack/addon-bone/commit/81db4e1ee86db6d1a341f43f847d7ef9e5d6ce40))




### 🛠️ Refactoring

* add changeSidebarIcon declaration ([8fa6ed2](https://github.com/addon-stack/addon-bone/commit/8fa6ed299f77a6e3f687ffaf8edfa26353a2c092))





### 🙌 Contributors

- [Addon Stack](mailto:addonbonedev@gmail.com) — commits: 8

## 🚀 Release `adnbn` v0.4.1 (2025-10-10)


### 🐛 Bug Fixed

* include `scripts` in published files ([7ed4238](https://github.com/addon-stack/addon-bone/commit/7ed4238c0536e46f691c7018254d820888791286))





### 🙌 Contributors

- [Addon Stack](https://github.com/addon-stack) (@addon-stack) — commits: 1
- [Addon Stack](mailto:addonbonedev@gmail.com) — commits: 1

## 🚀 Release `adnbn` v0.4.0 (2025-10-10)


### ⚡️ Performance Improvements

* configure husky and commitlint for commit message validation ([d40b8cb](https://github.com/addon-stack/addon-bone/commit/d40b8cbed2e47aad3f080412fe4e941eb1efd686))

  - Added Husky hooks for `pre-commit`, `pre-push`, and `commit-msg`.
  - Integrated Commitlint with conventional commit configuration.
  - Updated `.gitattributes` for consistent line endings.
  - Added necessary scripts and dependencies in `package.json`.



### ✨ Features

* add Firefox locale validator and integrate it into locale handling ([fc97578](https://github.com/addon-stack/addon-bone/commit/fc9757899fb4342d7cb1ae16ae9a4bd72e71449b))


* add Opera-specific locale validator and update locale builder logic ([f682b4c](https://github.com/addon-stack/addon-bone/commit/f682b4c5d96e11e1319cfc2e9b967bc072ee076a))




### 🤖 CI

* add release-it configuration for automated versioning and changelog generation ([cdafd06](https://github.com/addon-stack/addon-bone/commit/cdafd06934b1d4c15a4e7496fd175c05cf3f70a2))

  - Introduced `.release-it.cjs` configuration file with custom plugins and GitHub integration.
  - Added `@release-it/conventional-changelog` and `release-it` dependencies.
  - Updated `package.json` and `package-lock.json` with new devDependencies.

* update workflow naming and correct npm script usage ([f1b06ae](https://github.com/addon-stack/addon-bone/commit/f1b06aeaf878038313a5d8bcb429048ae8a90b58))




### 🧹 Chores

* add release and release:preview commands to package.json ([360f546](https://github.com/addon-stack/addon-bone/commit/360f546d46ad545619755be710753654f6ed3c05))


* **ci:** update job name order in workflow configuration ([8409775](https://github.com/addon-stack/addon-bone/commit/8409775904d622d7cc7a50673f9d950138a8e910))


* **dependencies:** update package-lock.json with additional dependencies and version updates ([d0fe719](https://github.com/addon-stack/addon-bone/commit/d0fe71971be2fc20b0e9b3a675dad9c4a6fb064b))


* **deps:** update core-js-compat to v3.46.0 in package-lock.json ([6aedcda](https://github.com/addon-stack/addon-bone/commit/6aedcda774c4354868c5092d7daa0673c8f3faef))


* **deps:** update dependencies ([feea325](https://github.com/addon-stack/addon-bone/commit/feea325741efe26d72b6dd5aa91ec3f09e1997bd))


* **prettier:** update `.prettierignore` to exclude GitHub workflows directory ([8d8d303](https://github.com/addon-stack/addon-bone/commit/8d8d303bbac97537e618aaa3469fe38d729e2294))


* sync lockfile with package.json ([86e5ba1](https://github.com/addon-stack/addon-bone/commit/86e5ba1b4bd5ea093f156c19035802e648b2d26e))


* **typings:** add module declarations and type definitions for `adnbn` modules ([70aeb5c](https://github.com/addon-stack/addon-bone/commit/70aeb5c9ed9868dbd81448eab55dc517de675d10))


* update author details and add .mailmap file ([2306a3d](https://github.com/addon-stack/addon-bone/commit/2306a3de91f2615150b526548ba826bcbbcb0dcb))

  - Updated `author` and `contributors` fields in `package.json`.
  - Added `.mailmap` file to map consistent author metadata.

* update dependencies and adjust package-lock.json ([8b0ded1](https://github.com/addon-stack/addon-bone/commit/8b0ded179eced4d7d29124aadc674e09ac3eb82b))

  - Added `esbuild` and optional dependency `@esbuild/darwin-arm64`.
  - Upgraded dependencies including `@jsonjoy.com/json-pack`, `get-tsconfig`, and `string-width`.
  - Downgraded `wrap-ansi` to maintain compatibility.
  - Consolidated redundant `meow` and `ansi-styles` version references.

* update release-it configuration and repository URL ([4ce1612](https://github.com/addon-stack/addon-bone/commit/4ce1612ae6218dad0600f969204aeba49668ba42))




### 🛠️ Refactoring

* adjust plugins, CI matrix, and Node.js version support ([b387cc1](https://github.com/addon-stack/addon-bone/commit/b387cc18c51ee719f6a86eb28c104a82d41af2fc))

  - Refactored `fixVirtualIndexImportPlugin` to use a function for consistency.
  - Updated CI workflows to modify Node.js version matrix and defaults.
  - Bumped Node.js version to 22 in `release.yml` for Node.js setup.
  - Simplified error message handling in `check-node-version.js`.

* restructure vendor declarations and improve alias handling for typescript plugin ([df85fcd](https://github.com/addon-stack/addon-bone/commit/df85fcd9d14b401827640b7882c2e19a00e24fc5))

  - Moved vendor declaration files to `vendor` folder for better organization.
  - Introduced `vendorAliases` for alias mapping in `TypescriptConfig`.
  - Added `paths` helper method to streamline `paths` generation in TypeScript configuration.
  - Updated `include` and `paths` in `TsConfigJson` for cleaner configuration.

* update dependencies and migrate to `@addon-core` packages ([bfab53e](https://github.com/addon-stack/addon-bone/commit/bfab53ec0a9551a59471b498c3f0e3b4cdcaa0dc))

  - Replaced `@adnbn/*` packages with `@addon-core/*` equivalents.
  - Added `@addon-core/storage` dependency.
  - Updated package version to `0.3.0`.
  - Removed unused `storage` exports and test scripts from `package.json`.



### Tests

* migrate fixtures to `tests/fixtures` directory for better structure ([9304995](https://github.com/addon-stack/addon-bone/commit/930499587b9fe7cf9cdd890f716eb040eb0f26cd))





### 🙌 Contributors

- [Addon Stack](https://github.com/addon-stack) (@addon-stack) — commits: 21
- [Addon Stack](mailto:addonbonedev@gmail.com) — commits: 4
- [Rostyslav Nihrutsa](mailto:rostyslav.nihrutsa@gmail.com) — commits: 2
