# CLI responsibilities

This directory owns configuration loading, extension source analysis, and build orchestration.
The rules below help place new code and preserve responsibility boundaries during refactoring.
See [AGENTS.md](../../AGENTS.md) for general code and testing conventions.
Write all technical documentation in this repository, including READMEs, in English.

[index.ts](./index.ts) declares CLI commands and options, passes them to the application builder,
and reports results or errors. The configuration resolver computes dependent defaults. The CLI
must preserve the distinction between an explicitly supplied option and an absent value.

## Directories

| Directory                  | Responsibility                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [builders](./builders)     | Build orchestration and output data. `app` manages compiler startup, one-shot builds, and watch mode; `manifest`, `csp`, and `locale` produce their respective results from prepared data. |
| [bundler](./bundler)       | Rspack integration: compiler plugins, loaders, asset processing, and build infrastructure.                                                                                                 |
| [entrypoint](./entrypoint) | Entrypoint discovery, source reading, parsing, and naming; normalized descriptions for the rest of the CLI.                                                                                |
| [handlers](./handlers)     | Handler execution. `plugin.ts` invokes plugin handlers sequentially, supports synchronous and asynchronous results, and yields them to the caller.                                         |
| [plugins](./plugins)       | Framework features: interpreting entrypoint options, configuring builds, preparing data, and declaring manifest requirements. Examples include content, background, style, and locale.     |
| [resolvers](./resolvers)   | Resolving one target result from input parameters. Each module exposes one function through `export default`.                                                                              |
| [utils](./utils)           | Basic filesystem and path helpers. They do not own configuration rules, application layout, or plugin execution order.                                                                     |
| [virtual](./virtual)       | Templates and generated modules that connect user entrypoints to the framework runtime.                                                                                                    |
| [workspace](./workspace)   | Project, application, shared-source, and output paths based on configuration and workspace mode; artifact name resolution.                                                                 |

### Entrypoint analysis

- `entrypoint/file` reads source files and analyzes the TypeScript AST: exports, expressions, and static values.
- `entrypoint/parser` defines the recognized definition, schema, defaults, and interpretation of the data read.
  Shared schema fragments live in `parser/schemas`. Parsers use the file reader and do not traverse the AST themselves.
- `entrypoint/finder` discovers and selects entrypoints using configuration and source precedence.
  Reuse these finders when a feature needs information about other entrypoints.
- `entrypoint/name` owns entrypoint names, and `entrypoint/utils` contains helpers shared within this layer.
  Finder-specific helpers stay in `entrypoint/finder/utils`.

### Rspack integration

- `bundler/plugins` contains classes that work with compiler hooks, runtime modules, emitted assets,
  and compilation validation. Such a class belongs here even when only one feature uses it.
- `bundler/plugins/utils` and `bundler/plugins/types.ts` hold shared infrastructure and contracts for these plugins.
  `bundler/utils` contains general algorithms for asset graphs, classification, and filenames.
- `bundler/loaders` contains source transformations used in the Rspack pipeline.
  `bundler/styles` owns style source preparation and related path and URL resolution.
- Each Rspack plugin keeps its own helpers, tests, and runtime templates beside its implementation.
  Plugin runtime templates do not move to `virtual`, which serves entrypoint wrappers.

## Resolvers

| Module                               | Target result                                                                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [config.ts](./resolvers/config.ts)   | Final application configuration: defaults, the user file, merging, normalization, and validation. Coordinates environment resolution and plugin list composition.     |
| [dotenv.ts](./resolvers/dotenv.ts)   | Environment variables for the supplied configuration. Loads the applicable `.env` files and updates `process.env`, including application-specific reserved variables. |
| [plugins.ts](./resolvers/plugins.ts) | Final plugin list: launch options → user configuration → built-in plugins. Creates built-in plugins in the established order.                                         |
| [bundler.ts](./resolvers/bundler.ts) | Final Rspack configuration: base settings and plugin handler results.                                                                                                 |

A resolver has one exported function and one responsibility. Use arrow functions for ordinary functions,
including `export default (...) => ...` and `export default async (...) => ...`.
Generators use `function*` or `async function*` because JavaScript has no arrow generator syntax.

Private types and helpers serving the same responsibility stay in the resolver file. For example,
initial defaults, their recalculation, merging, and validation belong in `config.ts`. Do not turn each
step into a separate exported resolver or move it to `utils` merely to shorten the file.
An independent responsibility, such as environment loading or plugin list composition, warrants its own module.

### Configuration resolution order

Preserve this sequence when changing `config.ts`:

1. Create the populated initial configuration from launch options and defaults, recording which
   dependent values were selected automatically.
2. Load the initial environment. Read the user file through `c12`, passing the initial configuration
   as `context`. Invoke the callback once per configuration resolution, before applying its result.
3. Apply user settings, normalize `lang` and `workspace`, recalculate automatically selected dependent
   defaults from the final inputs, normalize `sharedDir`, and validate the configuration.
4. Load the environment for the final configuration and merge it with the initial environment. Compose the plugin list.

Initial default calculation and recalculation share one implementation inside `config.ts`.
Preserve explicit values even when they equal the initial default: value comparison cannot determine
where a setting came from. Preserve the existing semantics of absent fields, `undefined`, empty strings, and `false`.
Recalculation must not reload the file, invoke the callback again, or create plugins again.

Template substitutions that depend on build output stay with their owners. For example, final asset
filenames and hashes are resolved by the bundler rather than during configuration loading.

## Three plugin responsibilities

`resolvers/plugins.ts` **composes the list**, `handlers/plugin.ts` **executes handlers**,
and `plugins/<feature>` **defines feature behavior**. Handler execution does not belong in resolvers,
basic `utils`, or `src/shared`, the layer shared with the extension runtime.

A feature uses entrypoint finders and builders, then passes data, options, or callbacks to Rspack plugins.
It does not import another feature's manager or implementation. A Rspack plugin must not receive a feature
manager, including a type disguised through `Pick`: its contract describes the required data and operations.
Feature policy and diagnostic context stay with the feature; hooks, emitted assets, and general compilation
validation belong to the Rspack plugin. Extract algorithms shared by sibling Rspack plugins below both consumers.

## Exports and imports

A directory representing an independent module exposes the interface its external consumers need
through `index.ts`. For example, use `@cli/workspace` and `@cli/handlers` instead of deep imports from
`@cli/workspace/paths` and `@cli/handlers/plugin`. Relative imports between files within a module are allowed.
List the required exports explicitly in new `index.ts` files, keeping private helpers inside the module.

Import resolvers by their target task: `@cli/resolvers/config` or `@cli/resolvers/bundler`.
The current `resolvers` directory has no shared `index.ts`. Directories that group modules, tests, or resources
do not need an `index.ts` solely for consistency.

A class that is the primary export of its file uses an explicitly named `export default` declaration;
its `index.ts` provides a named re-export, such as `export {default as LocaleBuilder} from "./LocaleBuilder"`.
Internal TypeScript imports use aliases or relative paths without the future `.js` output extension.
Imports of actual JavaScript files and raw templates retain the syntax required by their owner.

## Boundaries with other layers

- Shared domain contracts, enums, and constants belong in `src/types`; the CLI imports them through `@typing/*`.
  The public `src/main` layer exposes APIs and re-exports but does not own internal helpers.
- `src/shared` is for pure implementation needed by both the CLI and the extension runtime.
  Use by several parts of the CLI alone does not make a helper shared with the runtime.
- `src/entry` and the other runtime modules own extension execution and lifecycle behavior.
  The CLI does not import their implementations to obtain types, constants, or shared helpers.

Before moving code, identify who owns the behavior and who consumes it. Moving a file or re-exporting it
through `index.ts` does not fix an incorrect dependency direction. Refactoring preserves setting precedence,
environment and plugin order, user filename templates, manifest behavior, and watch updates.
Verify behavior at its owner and through existing integration boundaries. For configuration, these are the
[resolver tests](./resolvers/config.test.ts) and [CLI integrations](../../tests/integration/build/cli/config.integration.test.ts)
using real `c12`, a configuration file, and build output.
