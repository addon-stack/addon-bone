# Changelog

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
