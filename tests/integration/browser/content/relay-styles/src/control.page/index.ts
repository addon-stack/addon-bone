import {definePage} from "adnbn";
import {createPanel} from "../shared/panel";

export default definePage({
    name: "control",
    matches: ["http://127.0.0.1/*"],
    render() {
        const panel = createPanel("page");
        requestAnimationFrame(() =>
            parent.postMessage({type: "relay-page-color", color: getComputedStyle(panel).color}, "*")
        );
        return panel;
    },
});
