# Addon Bone

> **🚧 Active development** — the public API and documentation may change between releases. Full guides and API reference are being prepared at [addonbone.com](https://addonbone.com).

[![npm version](https://img.shields.io/npm/v/adnbn.svg?logo=npm&style=for-the-badge)](https://www.npmjs.com/package/adnbn)
[![npm downloads](https://img.shields.io/npm/dm/adnbn.svg?style=for-the-badge&color=blue)](https://www.npmjs.com/package/adnbn)
[![CI](https://img.shields.io/github/actions/workflow/status/addon-stack/addon-bone/ci.yml?style=for-the-badge)](https://github.com/addon-stack/addon-bone/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE.md)

A TypeScript framework for building browser extensions from a shared codebase.
Define extension entrypoints in source files; Addon Bone discovers them and creates
the browser-specific build and manifest.

## Install

```bash
npm i -D adnbn
```

## Get started

Create a project, then build it for production:

```bash
npx adnbn init
npx adnbn build
```

For project structure, entrypoint guides, and the API reference, visit
[addonbone.com](https://addonbone.com).

## Links

- [Documentation](https://addonbone.com)
- [Contributing](CONTRIBUTING.md)
- [Issues](https://github.com/addon-stack/addon-bone/issues)

## License

[MIT](LICENSE.md)
