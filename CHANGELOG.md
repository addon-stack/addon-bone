# Changelog

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
