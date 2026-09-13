import {createElement} from "react";
import {createRoot, type Root} from "react-dom/client";

import Context from "../../../../../../src/entry/content/core/context/ManagedContext";
import EventEmitter from "../../../../../../src/entry/content/core/context/EventEmitter";

// Browser feasibility probe only. No production iframe implementation is imported.
const context = new Context(new EventEmitter());
const url = (file: string): string => chrome.runtime.getURL(file);
const delay = () => new Promise(resolve => setTimeout(resolve, 20));

for (const renderer of ["vanilla", "react"]) {
    const anchor = document.createElement("section");
    document.querySelector("#anchors")!.append(anchor);
    const host = document.createElement("div");
    host.dataset.probe = renderer;
    const frame = document.createElement("iframe");
    host.append(frame);
    anchor.append(host);
    let target: HTMLElement | undefined;
    let root: Root | undefined;
    let generation = 0;
    let queued = false;
    let active = true;
    let resources: AbortController | undefined;

    const link = (doc: Document, file: string, signal: AbortSignal, retry = false): Promise<void> =>
        new Promise((resolve, reject) => {
            if (signal.aborted) return resolve();
            let element: HTMLLinkElement;
            const finish = (error?: Error) => {
                clearTimeout(timeout);
                element.onload = element.onerror = null;
                signal.removeEventListener("abort", cancel);
                if (error || signal.aborted) element.remove();
                if (error) reject(error);
                else resolve();
            };
            const cancel = () => finish();
            const timeout = setTimeout(() => finish(new Error("CSS timeout: " + file)), 4000);
            signal.addEventListener("abort", cancel, {once: true});
            const start = () => {
                element = doc.createElement("link");
                element.rel = "stylesheet";
                element.href = url(file);
                element.onload = () => finish();
                element.onerror = () => {
                    if (retry && !signal.aborted) {
                        retry = false;
                        element.onload = element.onerror = null;
                        element.remove();
                        start();
                    } else finish(new Error("CSS error: " + element.href));
                };
                doc.head.append(element);
            };
            start();
        });
    const recover = () => {
        if (queued || !active) return;
        queued = true;
        queueMicrotask(() => {
            queued = false;
            if (active && host.isConnected) context.mount();
        });
    };
    frame.addEventListener("load", recover);
    context.add({
        anchor,
        container: host,
        get target() {
            return target;
        },
        mount() {
            const doc = frame.contentDocument;
            if (!doc) throw new Error("Empty iframe document is inaccessible");
            if (target?.ownerDocument === doc && target.isConnected) return false;
            resources?.abort();
            resources = new AbortController();
            const {signal} = resources;
            root?.unmount();
            target = doc.createElement("div");
            doc.body.append(target);
            const current = ++generation;
            host.dataset.generation = String(current);
            host.dataset.ready = "loading";
            delete host.dataset.error;
            const initial = link(doc, "initial.css", signal, current > 1);
            if (renderer === "react") {
                root = createRoot(target);
                root.render(
                    createElement("div", {className: "probe"}, createElement("span", {className: "font"}, "AAAA"))
                );
            } else {
                const probe = doc.createElement("div");
                probe.className = "probe";
                const text = doc.createElement("span");
                text.className = "font";
                text.textContent = "AAAA";
                probe.append(text);
                target.append(probe);
            }
            void (async () => {
                await initial;
                if (signal.aborted) return;
                // CSS requested after initial render, not eagerly inserted with initial styles.
                await link(doc, "lazy.css", signal);
                if (signal.aborted) return;
                await doc.fonts.load('40px "IframeCssProbe"', "AAAA");
                const started = Date.now();
                while (active && generation === current && Date.now() - started < 4000) {
                    const probe = target!.querySelector(".probe");
                    const widths = Array.from(target!.querySelectorAll(".font"), element => {
                        const range = doc.createRange();
                        range.selectNodeContents(element);
                        return range.getBoundingClientRect().width;
                    });
                    const style = probe && doc.defaultView!.getComputedStyle(probe);
                    host.dataset.measurements = JSON.stringify({
                        widths,
                        color: style?.color,
                        background: style?.backgroundColor,
                    });
                    if (
                        style?.color === "rgb(17, 85, 153)" &&
                        style.backgroundColor === "rgb(34, 102, 68)" &&
                        widths.length === 1 &&
                        widths.every(width => Math.abs(width - 320) < 0.1)
                    ) {
                        host.dataset.ready = "true";
                        return;
                    }
                    await delay();
                }
                if (generation === current) throw new Error("CSS or real font measurement did not match");
            })().catch(error => {
                if (active && generation === current) {
                    host.dataset.error = String(error);
                    host.dataset.ready = "error";
                }
            });
            return true;
        },
        unmount() {
            active = false;
            generation++;
            frame.removeEventListener("load", recover);
            resources?.abort();
            root?.unmount();
            host.remove();
            return true;
        },
    });
}
context.mount();

// Move in the same task that starts initial CSS, before any resource load callback can run.
for (const node of context.nodes) document.querySelector("#destination")!.append(node.container!);
