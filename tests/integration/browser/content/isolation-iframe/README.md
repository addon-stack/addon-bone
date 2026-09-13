# Iframe content integration

This fixture uses the production `isolation: Iframe` API with a React primary entry, a Vanilla
secondary entry and an ordinary content entry. Shared CSS verifies manifest and WAR delivery to
both kinds of consumers. Each isolated entry has its own style registry.

UI CSS uses `?isolation`. The local font is declared with `@font-face` in iframe CSS, with no
FontFace registration in JavaScript. Ordinary CSS remains in the host document.

The site directory contains the receiving page and child frame, not extension entrypoints. Tests
run with and without strict CSP. They measure actual colors and font width, check early/lazy imports,
and move, detach and reinsert hosts. The first Mount moves the host synchronously while initial CSS
is pending, exercising the one permitted stylesheet retry during document recovery. Later moves
exercise loaded documents. Mount counts verify recovery without duplicate initial mounts;
the secondary entry tests recovery after the normal anchor search stops.

```sh
npm run build
npx jest --testPathPatterns='isolation-iframe(\.firefox)?\.integration.test' --runInBand
```

Chrome MV3 and Firefox MV2/MV3 reports, including versions, are written to
`.cache/integration/isolation-iframe-<browser>-mv<version>.json`.
