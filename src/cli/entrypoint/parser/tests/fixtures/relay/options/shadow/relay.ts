import {defineRelay} from "adnbn";

export default defineRelay({
    // @ts-expect-error Relay entrypoints do not support Shadow DOM rendering.
    shadow: true,
    init: () => ({scan: () => true}),
});
