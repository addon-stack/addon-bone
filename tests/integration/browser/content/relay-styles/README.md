# Relay style routing

Two native Relay panels share a component and use Shadow/blank iframe rendering. An extension page
imports that same component (where `?isolation` is inert). Background calls both Relays through Messaging RPC.
Each call imports lazy document and UI CSS and checks their actual application before returning.
The Shadow Relay uses `isolation: {type: Shadow, mode: Closed}`. Its RPC result includes measurements from the closed
root and verifies that `host.shadowRoot` is `null`; rendering and lazy styles still work.
A third Relay embeds this page through `isolation.page`, exercising the navigation adapter and WAR check.
The caller is a privileged background context: a web-accessible iframe is not a portable
privileged extension context in Firefox. The page reports only its measured style to its parent;
all panel commands and results go through the production Relay transport.

The `site` directory is the host website. Run with the existing Chrome CDP / Firefox BiDi harness:

```sh
npm run build
npx jest --runTestsByPath tests/integration/browser/content/relay-styles.integration.test.ts --runInBand
```
