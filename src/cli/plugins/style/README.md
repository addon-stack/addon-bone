# Shared and app styles

With `mergeStyles` enabled, importing a shared stylesheet also includes the app
stylesheet at the same relative path. Both sources compile as one CSS module,
using the shared resource path and the existing app-specific class-name salt.
Shared body rules precede app body rules. Ordinary, `?unisolated`, and `?asis`
imports retain their existing routing and CSS module behavior.

## Source preparation

The common implementation lives in `cli/bundler/styles`. It prepares every
entry stylesheet, including standalone files and builds with `mergeStyles: false`.
Local `@use`, `@forward`, and Sass `@import` requests resolve from their original
source file. Explicit `./` and `../` requests retain that base even when missing;
a bare request is made source-local only when a matching local Sass file exists.
Sass still selects partials, directory indexes, and import-only files, and reports
ambiguous imports. Package requests, aliases, and built-in Sass modules retain
normal resolution. Module parameters such as `as`, `show`, `hide`, and `with`
remain intact. File URLs represent local Sass requests safely on Windows and in
project directories containing spaces.

Sources share one Sass scope. Their leading Sass variables and module directives
precede the CSS prelude and the ordered bodies. App prelude variables can affect
the shared body; use distinct variables or configured modules when those values
must differ. An original source with a late `@use` or `@forward` fails preparation
with its filename and location.

Only identical, unconfigured module directives occurring once in each source are
collapsed across sources. Variable assignments, configured module loads, CSS
imports, and body rules are retained. Repeated directives within a single source
remain visible to Sass. Two identical relative requests from different directories
can identify different modules; give them distinct namespaces when both are needed.

## Resources in partials and module configuration

Sass compiles with an internal source map. The framework then runs
`resolve-url-loader` before css-loader, resolving relative resources in imported
partials from the Sass source map. This also works when production output source
maps are disabled; internal maps do not force emitted `.map` files.

```scss
// src/apps/example/content/content.scss
@use "../theme/fonts";
```

```scss
// src/apps/example/theme/fonts/_index.scss
@font-face {
    font-family: Inter;
    src: url("./Inter-Latin.woff2?browser") format("woff2");
}
```

Full literal URLs passed through `with` also remain supported:

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

Before Sass runs, literal resource URLs in entry sources are converted to absolute
filesystem requests. This preserves the declaring file's base through variable
substitution and prevents the partial-resource pass from rebasing those values a
second time. Query strings and fragments are retained for the CSS and asset loaders.
Explicit `@` and `~` resource requests remain available to css-loader's resolver;
other bare resource paths are treated as local files.

If another plugin already installs `resolve-url-loader` in the resource's effective
loader chain, the framework's adapter leaves processing to that loader. This avoids
double rebasing and loss of source maps with existing plugins. The compatibility
rule concerns that loader specifically, not arbitrary custom URL processors.

## Reusing font settings

Keep a full literal URL and the declaration that consumes it in the same Sass
module. Export a mixin containing the complete `@font-face` rule to reuse it from
different entry stylesheets:

```scss
// src/apps/example/theme/fonts/_index.scss
$family: Inter;
$font: url("./Inter-Latin.woff2?browser");

@mixin register-fonts {
    @font-face {
        font-family: $family;
        font-style: normal;
        font-weight: 400 900;
        font-display: swap;
        src: $font format("woff2");
    }
}
```

```scss
// src/apps/example/relay/relay.scss
@use "../theme/fonts";

@include fonts.register-fonts;

.panel {
    font-family: fonts.$family, sans-serif;
}
```

The source map keeps the `src` declaration attached to the fonts module, so its
relative resource resolves beside that module in both standalone and merged entry
stylesheets. Each `@include` emits the rule; include it once per stylesheet that
needs to register the font. Names, weights and other settings without resource
paths can be reused separately.

This preparation is internal to the framework. Plugins that generate stylesheets
still own their source selection, generated content and watch dependencies.

## Limitations and migration

- Relative resource URLs in imported partials now resolve beside the partial.
  Update paths that previously relied on resolution from the entry stylesheet.
- Write `url(...)` in lowercase inside imported partials: the resource loader does
  not rebase uppercase `URL(...)` or mixed-case variants there.
- Interpolated module requests and `meta.load-css()` arguments are not rewritten.
- Building resource paths with `url($path)` or interpolation is outside the supported
  contract. In a merged app body, the source map can attribute such a declaration
  to the shared file and resolve the resource from the shared directory.
- A full relative URL declared in imported partial A and used as `src: a.$font`
  in file B can resolve from B, because source maps track emitted declarations,
  not variable origins. Keep the URL and `src` together in a mixin as above, or
  pass a full literal URL from an entry source through `with`. Entry-source URLs
  are prepared before Sass; imported partial variables are not.
- Sass reports errors in a merged app body against the target resource with
  positions in the merged text. Imported modules retain their own file positions.
- Source-relative Sass requests intentionally address the source's own directory.
  Imports intended to reuse a shared module must explicitly address it or use an
  alias to shared.
- Repeated variable assignments and configured module loads are no longer removed
  by broad prelude deduplication. Variables follow Sass assignment order; duplicate
  configured loads may now expose a Sass error that older merging hid.

## Watch dependencies and errors

Ordinary source preparation runs through `sass-loader.additionalData`. Existing
app overrides are registered with `addDependency`; absent overrides use
`addMissingDependency`, so creation, removal, and recreation trigger compilation.
In prepared entry sources, local candidates for bare and explicit `./` or `../`
Sass requests are also registered, including missing partials and indexes. Creating
a local module can therefore replace a bare request's fallback or recover a failed
relative import without editing the entry stylesheet. Sass and the asset loaders
register imported modules and resources.

Preparation errors are emitted as compilation errors and produce no stylesheet,
because sass-loader 16 does not forward errors thrown by `additionalData` through
its loader callback. Sass compilation errors retain Sass's own diagnostics. A
failed override never falls back to a successful shared-only build.
