import {defineBackground, defineOffscreen, definePopup, defineSandbox, defineSidebar} from "adnbn";

// Keep helpers from the same public modules without consuming their generated data.
(globalThis as typeof globalThis & {definitions: unknown}).definitions = [
    definePopup({name: "local-popup"}),
    defineSidebar({name: "local-sidebar"}),
    defineOffscreen({name: "localOffscreen", init: () => ({})}),
    defineSandbox({name: "localSandbox", init: () => ({})}),
];

export default defineBackground({});
