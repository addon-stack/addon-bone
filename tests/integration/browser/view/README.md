# View browser fixtures

See the [integration guide](../../README.md) for editor preparation, dependency setup, and test isolation.

Run only the view rendering case from the repository root:

```bash
npm run test -- tests/integration/browser/view/render.integration.test.ts --runInBand
```

The `render` application checks, in Chrome MV3, the view builder that the build injects by file extension:

- `worker.offscreen.tsx` and `frame.sandbox.tsx` render React components with their `title` as props. The popup reads the rendered text and `document.title` through `getOffscreen` and `getSandbox`.
- `plain.offscreen.ts` has no render: its default function is the transport init, and its document gets no view container.
- `text.page.tsx`, `markup.page.ts` and `note.content.tsx` render the string `"<b>…</b>"` with the React view, Vanilla view and React content adapters. Each shows the tags as text; no `<b>` element is created.

`site/top.html` is served locally for the content script. The case also checks that the manifest requests only the `offscreen` permission and that the attached pages report no runtime errors.
