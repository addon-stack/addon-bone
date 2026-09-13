import {options} from "#adnbn/relay";

// Inspect the generated payload independently of browser APIs; Relay RPC has browser coverage.
(globalThis as typeof globalThis & {readRelayOptions: () => unknown}).readRelayOptions = () => options;

export default () => {};
