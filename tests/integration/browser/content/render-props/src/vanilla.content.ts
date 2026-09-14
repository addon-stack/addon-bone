import {defineContentScript} from "adnbn";
import {prepare} from "./shared/prepare";
import {main} from "./shared/lifecycle";

export default defineContentScript({
    matches: ["http://127.0.0.1/*"],
    anchor: "#vanilla",
    prepare,
    main,

    render: ({anchor, data, container, target}) => {
        anchor.setAttribute(
            "data-snapshot",
            JSON.stringify({label: data.label, same: container === target, connected: target.isConnected})
        );

        const span = target.ownerDocument.createElement("span");
        span.textContent = data.label;

        return span;
    },
});
