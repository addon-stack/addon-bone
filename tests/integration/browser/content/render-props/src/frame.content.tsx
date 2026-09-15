import {setupBoundary} from "./shared/boundary";
import {defineContentScriptAppend} from "adnbn";
import {Panel} from "./shared/Panel";
import {prepare} from "./shared/prepare";
import {main} from "./shared/lifecycle";

export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/*"],
    anchor: "#frame",
    isolation: "iframe",
    prepare,
    main,
    boundary: props => {
        props.boundary.title = props.data.label;
        props.boundary.style.height = "260px";

        return setupBoundary(props);
    },

    target: ({document, anchor}) => {
        anchor.setAttribute("data-target-calls", String(Number(anchor.getAttribute("data-target-calls") ?? 0) + 1));
        const target = document.createElement("section");
        target.className = "custom-target";

        return target;
    },
    render: Panel,
});
