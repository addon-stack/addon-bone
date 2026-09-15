import {defineRelay} from "adnbn";

export default defineRelay({
    name: "headlessProbe",
    matches: ["http://127.0.0.1/*"],
    anchor: "#headless",
    isolation: "shadow",
    render: true,

    container: () => {
        throw new Error("Headless mode must not create a container");
    },

    target: () => {
        throw new Error("Headless mode must not create a target");
    },

    init: () => ({}),

    main(_instance, context) {
        const [node] = context.nodes;
        node.anchor.setAttribute("data-headless", String(!node.container && !node.boundary && !node.target));
    },
});
