# View entrypoints

A view is an extension document that renders UI into its own page: popup, sidebar, options, page and the
override pages (`newtab`, `bookmarks`, `history`). Offscreen and sandbox documents also host a view next to
their transport. This README describes the runtime in this directory and the contracts in
[`src/types/view`](../../types/view).

## Public API

Define a view with its `define*` helper from `adnbn`: `definePopup`, `defineSidebar`, `defineOptions`,
`definePage`, `defineNewtab`, `defineBookmarks`, `defineHistory`. `defineOffscreen` and `defineSandbox`
accept the same `render` and `container` options. The render contract is exported from `adnbn` as
`ViewRenderValue`, `ViewRenderHandler`, `ViewVanillaRenderValue`, `ViewReactRenderValue` and
`ViewRenderReactComponent`, next to `ViewDefinition` and `ViewOptions`.

```tsx title="src/popup.tsx"
import {definePopup} from "adnbn";

export default definePopup({
    title: "Popup",
    render: ({title}) => <h1>{title}</h1>,
});
```

```ts title="src/help.page.ts"
export const title = "Help";

export default async () => {
    const response = await fetch("/help.json");
    const heading = document.createElement("h1");

    heading.textContent = (await response.json()).title;

    return heading;
};
```

## Adapter selection and generated modules

The entrypoint filename selects the renderer adapter: `.tsx` and `.jsx` use React
(`adnbn/entry/view/react`), other script extensions use Vanilla (`adnbn/entry/view/vanilla`). Every view
build selects an adapter, so there is no common `adnbn/entry/view` subpath.

The generated module ([`src/cli/virtual/view.ts`](../../cli/virtual/view.ts)) imports the selected adapter as
`virtual:view-builder` and makes one call: `view(resolveDefinition(module))`. Offscreen and sandbox inject the
adapter's `Builder` class into their own runtime instead:
`offscreen(resolveDefinition(module, name), ViewBuilder)`. Their builder composes the transport with a view
built from the definition without `init`, `main` and `name`; their transport options, in turn, never contain
`render` or `container`. The runtimes of `adnbn/entry/offscreen` and `adnbn/entry/sandbox` import no view
adapter.

## Definitions

`mergeDefinition(module, isRenderInput)` in [`resolvers/definition.ts`](resolvers/definition.ts) merges the
module exports using the selected adapter's interpretation of the default export:

- a default value the adapter recognizes as a render becomes `render` and overrides a named `render`;
- a plain default object overrides the named exports;
- any other default value leaves the named exports as they are.

Each adapter exposes `resolveDefinition` from its `index.ts`. Vanilla recognizes functions and the
framework-independent values below; React also recognizes React elements through `isValidElement`, so no
common code checks `$$typeof`. For offscreen and sandbox the default export is the transport `init`, resolved
by the transport resolver, never a render.

## Building and rendering

[`Builder.ts`](Builder.ts) is the single abstract builder. Its constructor normalizes the definition: the
container through [`resolvers/container.ts`](resolvers/container.ts) and the render through the adapter's
`resolveRender()`. Without an adapter, a defined render throws. `build()`:

1. destroys the previous run and sets `document.title` from `title`;
2. calls the render with the definition options as props (the definition without `render` and
   `container`); a view renders once, so the handler may be asynchronous;
3. creates nothing when the render or its value is absent;
4. creates the container, prepends it to `document.body`, and only then calls the adapter's `mount()`, so a
   renderer may measure connected DOM.

`destroy()` calls the adapter's `unmount()` and removes the container, even when `unmount()` throws. An
adapter implements only what depends on its framework:

- `resolveRender()` decides what the render input means and drops values the adapter cannot render. Vanilla
  calls a function and uses its (awaited) result; React treats a function as a component invoked by React,
  so it may use hooks.
- `mount()` puts the value into the container. React creates a root for React elements; `unmount()` unmounts
  it.

Every adapter renders the framework-independent values the same way, shared with the content adapters
through [`src/entry/core/render.ts`](../core/render.ts):

| Render value                                    | Result                                                       |
| ----------------------------------------------- | ------------------------------------------------------------ |
| Nonempty string, number                         | Text through `textContent`; a string is never parsed as HTML |
| DOM element                                     | Appended as is, including elements created in another realm  |
| React element or component (React adapter only) | Rendered by React                                            |
| Empty string, boolean, `null`, `undefined`      | Nothing; no container is created                             |

Markup comes from elements or from the UI framework, never from a string.

## Types

View contracts live in `src/types/view`, organized like the content contracts:

- `common.ts` owns options, the container contracts and the builder contract.
- `adapters/vanilla.ts` and `adapters/react.ts` describe each adapter's render values.
- `adapters/index.ts` exports the types of all adapters.
- `render.ts` combines those values into `ViewRenderValue` and `ViewRenderHandler`.
- `definition.ts` owns `ViewRenderDefinition` (the `render` and `container` mixin adopted by offscreen and
  sandbox), `ViewDefinition`, the resolved definition and the injected builder constructor.
- `index.ts` exports the contracts through `@typing/view`.

## Adding an adapter

Add `adapters/<name>/` with `Builder.ts` (extending the common `Builder` with `resolveRender()`, `mount()` and,
when the framework owns state in the container, `unmount()`), `definition.ts` (`resolveDefinition` through
`mergeDefinition`) and `index.ts` (the builder, `resolveDefinition` and `Builder.resolver()` as the default
export). Keep tests beside each file. Describe its render values in `src/types/view/adapters/<name>.ts`,
export them from `adapters/index.ts`, and include them in `render.ts`. Selecting the adapter for a filename
belongs to the CLI (`Framework` and `inferEntrypointFramework`); the package already exports
`adnbn/entry/view/*`.

## Verification

- `resolvers/definition.test.ts` and `adapters/*/definition.test.ts` cover merging and each adapter's render
  recognition; `adapters/*/Builder.test.ts` cover the container lifecycle, props, text and element values
  through the public `build()` and `destroy()`.
- [`src/entry/core/render.test.ts`](../core/render.test.ts) covers the shared value contract.
- `src/entry/offscreen/index.test.ts` and `src/entry/sandbox/index.test.ts` cover the transport and view
  composition.
- [`src/cli/virtual/virtual.test.ts`](../../cli/virtual/virtual.test.ts) checks the generated modules and that
  React stays in the React adapter's bundle graph, out of the offscreen and sandbox runtimes.
- `tests/integration/types/view.integration.test.ts` checks the public types through the source and built
  package APIs; `tests/integration/browser/view` renders offscreen, sandbox, page and content views in
  Chrome; `tests/integration/browser/options` covers Vanilla and React pages, and
  `tests/integration/browser/override` the override pages.
