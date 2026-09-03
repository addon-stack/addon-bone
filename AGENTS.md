# Repository conventions

## Symbol naming

- Apply these conventions throughout the project: shared types, runtime APIs, entrypoints, CLI, bundler plugins, and tests.
- Before introducing or renaming a symbol, inspect related declarations and reuse their domain vocabulary and capitalization, for example `Entrypoint`, not `EntryPoint`.
- Keep third-party contracts and platform API names unchanged; these rules apply to symbols owned by the project.
- Use PascalCase for classes, interfaces, type aliases, enums, and enum members. Use camelCase for functions, methods, parameters, and local variables.
- Name related exported types using **domain + concept + role or variant**. Keep the shared family prefix intact and append the distinguishing part: `ContentScriptContainerOptions`, `ContentScriptContainerFactory`, `ViewRenderHandler`, `EntrypointAssetsMapEntry`.
- Give each family a clear base name for its main contract. Name related shapes consistently, for example `EntrypointAssets`, `EntrypointAssetsFiles`, `EntrypointAssetsMap`, and `EntrypointAssetsMapEntry`.
- Suffixes must describe the actual role or shape: `Map` for a keyed collection, `MapEntry` for its value, `Options` for configuration, and `Handler` for a callable handler. Do not use the same name for different data shapes.
- Name classes after their responsibility and role, such as `LocaleFinder` or `ContentParser`. Avoid names tied only to a temporary implementation detail or former file location.
- Keep private helpers and local variables concise when their surrounding scope already supplies the domain. Do not mechanically repeat a long public prefix everywhere.

## Public API naming

- Use **verb + domain concept** for exported functions. Prefer explicit names over ambiguous shortcuts, and use the same terminology as the associated types.
- For getters returning a named domain contract, align the function and result names: `getX(): X`. Preserve required wrappers such as `Promise<X>`. A getter returning a collection should also express that collection in its name.
- For example, use `getEntrypointAssets(): EntrypointAssets` and `getEntrypointAssetsMap(): EntrypointAssetsMap`. Avoid an unrelated pair such as `getBuildAssets(): EntrypointAssetsMap`.
- Add qualifiers such as `Current`, `Runtime`, or `Build` only when they identify a meaningful distinction. Do not add them merely to resolve a naming collision; first clarify the base contract and its related shapes.
- Keep access restrictions and behavior explicit in the API documentation and errors. A naming cleanup must not change the returned data, execution context, or loading behavior.

## Renaming existing symbols

- Update declarations, imports, re-exports, callers, tests, fixtures, and examples together, including the root `addon` playground and relevant documentation.
- Treat exported renames as public API changes. Do not silently preserve old aliases or remove compatibility that has been explicitly required.
- Keep renames focused. Do not change behavior or sweep unrelated existing names into the same change. Check for stale references and run validation appropriate to the affected code.

## File and directory naming

- Use PascalCase for a file whose primary export is a class or React component, matching that export's name: `LocaleFinder.ts`, `BuildAssetsMapPlugin.ts`, and `DiagnosticPanel.tsx`. Prefer a named class/component export so the relationship is explicit.
- Name tests for a specific class after that class, preserving PascalCase and adding the test suffix: `BuildAssetsMapPlugin.test.ts`, `ChunkLoaderPlugin.test.ts`, and `ContentManager.test.ts`.
- Use lowercase kebab-case for other multiword filenames, including helper modules, types, enums, configuration modules, and tests that are not dedicated to a class: `file-precedence.ts`, `entrypoint-assets.ts`, and `entrypoint-assets.integration.test.ts`.
- Use lowercase kebab-case for multiword directory names, including directories containing classes or React components: `entrypoint-assets` and `diagnostic-panel`.
- Preserve tool-required conventional names such as `AGENTS.md` and `README.md`, and recognized suffixes such as `.content.ts`, `.service.ts`, `.module.css`, and `.config.ts`. This rule does not change TypeScript symbol casing.
- Apply the rule to new and renamed paths. Do not mass-rename unrelated existing files as part of another task.
- Keep an entrypoint or component with its own styles and resources in one directory. A standalone entrypoint without related files can remain a single file.
- Keep finder-specific helper modules in `src/cli/entrypoint/finder/utils`.
