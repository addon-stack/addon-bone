import {ContentScriptAppend, defineContentScriptAppend} from "adnbn";

import sharedStyles from "../shared/styles.module.css";
import styles from "./styles.module.css";

export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/*"],
    allFrames: true,
    anchor: "[data-shadow-secondary]",
    append: ContentScriptAppend.Last,
    shadow: true,
    container: () => {
        const host = document.createElement("section");
        host.dataset.shadowProbe = "secondary";

        return host;
    },
    render() {
        const root = document.createElement("div");
        root.classList.add(styles.root, sharedStyles.shared);
        root.dataset.shadowResult = "secondary";
        root.dataset.frame = window === window.top ? "top" : "child";
        root.dataset.ready = "false";

        void import("./lazy")
            .then(module => {
                module.applyLazyStyle(root);

                return waitForStyles(root);
            })
            .then(() => {
                root.dataset.initialCss = "applied";
                root.dataset.asyncCss = "applied";
                root.dataset.sharedCss = "applied";
            })
            .catch(cause => {
                root.dataset.error = cause instanceof Error ? cause.message : String(cause);
                root.dataset.ready = "error";
            });

        return root;
    },
});

const waitForStyles = async (element: HTMLElement): Promise<void> => {
    const started = performance.now();

    while (
        getComputedStyle(element).color !== "rgb(119, 51, 34)" ||
        getComputedStyle(element).backgroundColor !== "rgb(85, 51, 119)" ||
        getComputedStyle(element).borderTopWidth !== "3px"
    ) {
        if (performance.now() - started > 10_000) {
            throw new Error("Secondary shadow styles did not apply within 10 seconds");
        }

        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }

    element.dataset.ready = "true";
};
