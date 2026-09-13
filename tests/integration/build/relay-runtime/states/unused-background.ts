import {definePage, defineRelay} from "adnbn";

// Keep the definition helpers from the same public modules, but no getters.
(globalThis as typeof globalThis & {definitions: unknown}).definitions = [
    definePage({name: "local-page-definition"}),
    defineRelay({name: "local-relay-definition", init: () => ({})}),
];

export default () => {};
