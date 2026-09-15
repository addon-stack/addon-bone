import {setupBoundary} from "./shared/boundary";
import {defineRelay} from "adnbn";
import {Panel} from "./shared/Panel";
import {prepare} from "./shared/prepare";
let ready = false;

export default defineRelay({
    name: "propsProbe",
    matches: ["http://127.0.0.1/*"],
    anchor: "#relay",
    isolation: "shadow",
    prepare,
    boundary: setupBoundary,
    target: "aside",
    render: Panel,

    init: () => ({
        status: () => ({ready}),

        report(value: object) {
            document.body.dataset.relayRpc = JSON.stringify(value);
        },
    }),

    main(_instance, context) {
        ready = context.nodes.size === 1;
    },
});
