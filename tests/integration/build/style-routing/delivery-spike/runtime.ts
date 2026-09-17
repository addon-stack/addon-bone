import vm from "vm";
import type {Stats} from "@rspack/core";
import type {EntrypointAssets} from "@typing/entrypoint";
import {origin} from "./compiler";

interface Element {
    tagName: string;
    href: string;
    src: string;
    ownerDocument: Document;
    parentNode?: Root;
    onload?: (event?: {type: string; target: Element}) => void;
    onerror?: (event: {type: string; target: Element}) => void;
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    remove(): void;
}

interface Document {
    createElement(tag: string): Element;
}

interface Root {
    ownerDocument: Document;
    insertBefore(node: Element, target: Element | null): Element;
    removeChild(node: Element): void;
}

interface StylesRuntime {
    initialize(resolveUrl: (file: string) => string): void;
    add(root: Root, target: Element | null): void;
    delete(root: Root): void;
}

interface Probe {
    styles(): StylesRuntime | undefined;
    assets(): EntrypointAssets;
    load(): Promise<{loaded: boolean}>;
}

export interface StyleRequest {
    target: string;
    file: string;
    link: Element;
    done: boolean;
}

// DOM/network boundary only. Emitted JavaScript and CSS scheduling are real;
// completing a link represents the browser reporting stylesheet readiness.
export const executeEntry = (stats: Stats, entry: string) => {
    const requests: StyleRequest[] = [];
    const scripts: string[] = [];
    const roots: Root[] = [];
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const source = (file: string) => stats.compilation.getAsset(file)!.source.source().toString();
    let context: vm.Context;

    const createDocument = (): Document => ({
        createElement(tag: string): Element {
            const attributes = new Map<string, string>();

            return {
                tagName: tag.toUpperCase(),
                href: "",
                src: "",
                ownerDocument: this,
                getAttribute: name => attributes.get(name) ?? null,
                setAttribute: (name, value) => {
                    attributes.set(name, value);
                },
                remove() {
                    this.parentNode?.removeChild(this);
                },
            };
        },
    });

    const createRoot = (ownerDocument: Document, name: string) => {
        const root: Root = {
            ownerDocument,
            insertBefore(node) {
                node.parentNode = root;

                if (node.tagName === "SCRIPT") {
                    const file = node.src.slice(origin.length);
                    scripts.push(file);
                    vm.runInContext(source(file), context);
                    queueMicrotask(() => node.onload?.({type: "load", target: node}));
                } else {
                    requests.push({target: name, file: node.href.slice(origin.length), link: node, done: false});
                }

                return node;
            },
            removeChild(node) {
                node.parentNode = undefined;
            },
        };

        return root;
    };

    const page = createDocument();
    const head = createRoot(page, "document");
    context = vm.createContext({
        document: {
            ...page,
            head: {...head, appendChild: (node: Element) => head.insertBefore(node, null)},
            getElementsByTagName: () => [],
        },
        console,
        setTimeout: (callback: () => void, delay: number) => {
            const timer = setTimeout(callback, delay);
            timers.add(timer);

            return timer;
        },
        clearTimeout: (timer: ReturnType<typeof setTimeout>) => {
            timers.delete(timer);
            clearTimeout(timer);
        },
    });
    vm.runInContext("self = globalThis", context);

    const loadEntry = (name: string): Probe => {
        for (const file of stats.compilation.entrypoints
            .get(name)!
            .getFiles()
            .filter(file => file.endsWith(".js"))) {
            vm.runInContext(source(file), context);
        }

        return context.deliveryProbe as Probe;
    };

    const probe = loadEntry(entry);
    const runtime = probe.styles();
    runtime?.initialize(file => origin + file);

    return {
        probe,
        loadEntry,
        requests,
        scripts,
        addRoot(kind: "shadow" | "iframe", name: string = kind) {
            const root = createRoot(kind === "iframe" ? createDocument() : page, name);
            roots.push(root);
            runtime!.add(root, null);

            return root;
        },
        settle(request: StyleRequest, event = "load") {
            request.done = true;

            if (event === "load") {
                request.link.onload?.({type: event, target: request.link});
            } else {
                request.link.onerror?.({type: event, target: request.link});
            }
        },
        close() {
            for (const root of roots) {
                runtime!.delete(root);
            }

            for (const timer of timers) {
                clearTimeout(timer);
            }
        },
    };
};
