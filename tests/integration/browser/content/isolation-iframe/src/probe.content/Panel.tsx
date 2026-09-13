import React, {useEffect, useRef} from "react";
import sharedStyles from "../shared/styles.module.css?isolation";
import styles from "./styles.module.css?isolation";

// Also proves that importing before the first iframe exists remembers its async stylesheet.
const Lazy = import("./lazy");

export default function Panel({anchor}: {anchor: Element}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const root = ref.current!;
        let active = true;
        root.dataset.ready = "false";
        root.dataset.frame = window === window.top ? "top" : "child";
        root.dataset.anchor = anchor.getAttribute("data-shadow-primary") ?? "unknown";
        void (async () => {
            const lazy = await Lazy;
            if (!active) return;
            lazy.applyLazyStyle(root);
            const doc = root.ownerDocument;
            const started = performance.now();
            while (active) {
                const range = doc.createRange();
                range.selectNodeContents(root.querySelector("span")!);
                const style = doc.defaultView!.getComputedStyle(root);
                root.dataset.measurement = JSON.stringify({
                    color: style.color,
                    background: style.backgroundColor,
                    border: style.borderTopWidth,
                    width: range.getBoundingClientRect().width,
                    fonts: Array.from(doc.fonts, font => ({family: font.family, status: font.status})),
                });
                if (
                    style.color === "rgb(17, 85, 153)" &&
                    style.backgroundColor === "rgb(34, 102, 68)" &&
                    style.borderTopWidth === "3px" &&
                    Math.abs(range.getBoundingClientRect().width - 320) < 0.1
                ) {
                    Object.assign(root.dataset, {
                        ready: "true",
                        initialCss: "applied",
                        asyncCss: "applied",
                        sharedCss: "applied",
                        font: "applied",
                    });
                    return;
                }
                if (performance.now() - started > 10000) throw new Error("Iframe CSS/font did not apply");
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        })().catch(error => {
            if (active) root.dataset.error = String(error);
        });
        return () => {
            active = false;
        };
    }, [anchor]);
    return (
        <div ref={ref} className={`${styles.root} ${sharedStyles.shared}`} data-shadow-result="primary">
            <span className={styles.font}>AAAA</span>
        </div>
    );
}
