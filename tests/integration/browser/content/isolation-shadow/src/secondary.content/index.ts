import {ContentScriptIsolation, ContentScriptShadowMode, ContentScriptAppend, defineContentScriptAppend} from "adnbn";

import sharedStyles from "../shared/styles.module.css?isolation";
import styles from "./styles.module.css?isolation";

let instance = 0;

export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/*"],
    allFrames: true,
    anchor: "[data-shadow-secondary]",
    append: ContentScriptAppend.Last,
    isolation: {type: ContentScriptIsolation.Shadow, mode: ContentScriptShadowMode.Closed},
    watch: true,
    container: () => {
        const host = document.createElement("section");
        host.dataset.shadowProbe = "secondary";
        host.dataset.instance = String(++instance);

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
                report(root);
            })
            .catch(cause => {
                root.dataset.error = cause instanceof Error ? cause.message : String(cause);
                root.dataset.ready = "error";
                report(root);
            });

        return root;
    },
});

// The page-side test deliberately cannot traverse a closed root. Publish measured
// results from inside the fixture, without exposing the root or changing production code.
const report = (element: HTMLElement): void => {
    const root = element.getRootNode() as ShadowRoot;
    if (!root.host) return;
    const style = element.ownerDocument.defaultView!.getComputedStyle(element);
    (root.host as HTMLElement).dataset.shadowReport = JSON.stringify({
        ...element.dataset,
        mode: root.mode,
        measured:
            style.color === "rgb(119, 51, 34)" &&
            style.backgroundColor === "rgb(85, 51, 119)" &&
            style.borderTopWidth === "3px",
        links: Array.from(root.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'), link => link.href),
    });
};

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
