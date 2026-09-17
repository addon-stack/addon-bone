import {defineContentScript} from "adnbn";

import sharedStyles from "./shared/styles.module.css";

export default defineContentScript({
    matches: ["http://127.0.0.1/*"],
    allFrames: true,
    render() {
        const element = document.createElement("div");
        element.className = sharedStyles.shared;
        element.dataset.normalProbe = "ready";

        return element;
    },
});
