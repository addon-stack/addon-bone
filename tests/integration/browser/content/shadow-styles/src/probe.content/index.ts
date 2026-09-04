import {ContentScriptAppend, ContentScriptWorld, defineContentScriptAppend} from "adnbn";

import probeFont from "./probe.woff2";
import sharedStyles from "../shared/styles.module.css";
import styles from "./styles.module.css";

const AsyncModule = import("./lazy");
const ExpectedWidth = 320;
let instance = 0;

const width = (element: Element): number => {
    const range = document.createRange();
    range.selectNodeContents(element);

    return range.getBoundingClientRect().width;
};

const waitForStyles = async (element: HTMLElement, predicate: () => boolean): Promise<void> => {
    const started = performance.now();

    while (!predicate()) {
        if (performance.now() - started > 10_000) {
            throw new Error("Shadow styles did not apply within 10 seconds");
        }

        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }

    element.dataset.ready = "true";
};

export default defineContentScriptAppend({
    matches: ["http://127.0.0.1/*"],
    world: ContentScriptWorld.Isolated,
    runAt: "document_end",
    allFrames: true,
    anchor: "[data-shadow-primary]",
    append: ContentScriptAppend.Last,
    watch: true,
    shadow: {
        fonts: [{family: "AdnbnShadowProbe", source: probeFont, weight: "400", style: "normal"}],
    },
    container: ({anchor}) => {
        const host = document.createElement("section");
        host.dataset.shadowProbe = "primary";
        host.dataset.anchor = anchor.getAttribute("data-shadow-primary") ?? "unknown";
        host.dataset.instance = String(++instance);

        return host;
    },
    render({anchor}) {
        const root = document.createElement("div");
        root.classList.add(styles.root, sharedStyles.shared);
        root.dataset.shadowResult = "primary";
        root.dataset.anchor = anchor.getAttribute("data-shadow-primary") ?? "unknown";
        root.dataset.frame = window === window.top ? "top" : "child";
        root.dataset.ready = "false";

        const font = document.createElement("span");
        font.className = styles.font;
        font.textContent = "AAAA";
        root.append(font);

        void AsyncModule.then(module => {
            module.applyLazyStyle(root);

            return document.fonts.load('40px "AdnbnShadowProbe"', "AAAA");
        })
            .then(() =>
                waitForStyles(
                    root,
                    () =>
                        getComputedStyle(root).color === "rgb(17, 85, 153)" &&
                        getComputedStyle(root).backgroundColor === "rgb(34, 102, 68)" &&
                        getComputedStyle(root).borderTopWidth === "3px" &&
                        Math.abs(width(font) - ExpectedWidth) < 0.1
                )
            )
            .then(() => {
                root.dataset.initialCss = "applied";
                root.dataset.asyncCss = "applied";
                root.dataset.sharedCss = "applied";
                root.dataset.font = "applied";
            })
            .catch(cause => {
                root.dataset.error = cause instanceof Error ? cause.message : String(cause);
                root.dataset.ready = "error";
            });

        return root;
    },
});
