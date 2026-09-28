# Shared and app styles

With `mergeStyles` enabled, importing a shared stylesheet also includes the app
stylesheet at the same relative path. Both sources compile as one CSS module,
using the shared resource path and the existing app-specific class-name salt.
Shared body rules precede app body rules. Ordinary, `?unisolated`, and `?asis`
imports retain their existing routing and CSS module behavior.

Before merging, the plugin rebases explicit `./` and `../` requests in `@use`
and `@forward` from each original file to the shared resource. Module parameters
remain intact; Sass resolves partials and directory indexes. Package requests,
aliases, built-in modules, and requests without an explicit relative prefix keep
their normal resolution. `rebase.ts` owns the request and URL rewriting;
`utils.ts` owns which nodes receive it, the prelude order, and deduplication.

Only identical prepared prelude statements are deduplicated. Shared requests pass
through the same normalization, so equivalent spellings of one module match. Two
identical relative requests from different source directories can refer to
different modules. Use distinct `as` namespaces when both modules need to
coexist; Sass still reports namespace and configuration conflicts.

## Resources configured through `with`

The plugin also rebases literal app `url(...)` values, including values supplied
inside module configuration. Query strings and fragments are preserved for the
normal CSS and asset loaders.

```scss
// src/apps/example/content/content.scss
@use "../theme/fonts" with (
    $inter-latin: url("../theme/fonts/Inter-Latin.woff2?browser")
);
```

```scss
// src/apps/example/theme/fonts/_index.scss
$inter-latin: url("./Inter-Latin.woff2?browser") !default;

@font-face {
    font-family: Inter;
    src: $inter-latin format("woff2");
}
```

Pass the complete `url(...)` from the app source.

## Limitations

- Only `@use` and `@forward` requests are rebased. Sass `@import` and
  `meta.load-css()` requests keep resolving from the shared resource.
- Resources written inside imported partials are not rebased. Pass the complete
  `url(...)` from the app source through `with`.
- URL aliases are not recognized. A `url(...)` without a scheme, root, `~`, `#`,
  or `?` prefix is treated as a relative resource, so an aliased or package URL
  written in an app source becomes a relative path and fails to resolve. Write a
  full relative `url(...)` from the app source; alias-aware URL rewriting would
  have to follow the bundler resolve settings.
- Dynamic Sass URL expressions and interpolated requests are left for Sass to
  evaluate.
- Sass reports errors in the merged app body against the shared resource with
  positions in the merged text. Errors inside imported modules keep their own
  file positions.

## Migration

Relative `@use` and `@forward` requests in app sources used to resolve from the
shared file. They now resolve from the app file, as written. An app stylesheet
that intentionally reuses a shared module through such a request must address
it by a path or a configured alias to the shared directory.

## Watch dependencies and errors

Preparation runs through `sass-loader.additionalData`. Existing overrides are
registered with `addDependency`; absent overrides use `addMissingDependency` so
creation, removal, and recreation trigger compilation. Sass and the asset loader
register imported modules and resources.

Preparation errors are emitted as compilation errors and produce no stylesheet,
because sass-loader 16 does not forward errors thrown by `additionalData` through
its loader callback. Sass compilation errors retain Sass's own diagnostics. A
failed override never falls back to a successful shared-only build.
