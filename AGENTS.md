# Repository conventions

## TypeScript file naming

- Use PascalCase filenames only when the file's primary export is a class, for example `LocaleFinder.ts`.
- Use camelCase filenames for modules that export helper functions, utilities, constants, enums, or types without a primary class, for example `utils/filePrecedence.ts`.
- Keep finder-specific helper modules in `src/cli/entrypoint/finder/utils`.
