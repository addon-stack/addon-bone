import {readContentStyles} from "#adnbn/runtime";
import {renderIsolatedStylesRuntime} from "@cli/bundler/plugins/isolated-styles/templates";
import {ContentScriptEvent, type ContentScriptStylesRuntime} from "@typing/content";
import VanillaNode from "../../adapters/vanilla/Node";
import ReactNode from "../../adapters/react/Node";
import {act, waitFor} from "@testing-library/react";
import {createElement, useEffect, useLayoutEffect} from "react";
import IsolationSetup from "../IsolationSetup";
import {ContainerRegistry, EventEmitter} from "../context";
import {EventNode, FrameNode, MountNode, Node, ShadowNode} from "./index";

jest.mock("#adnbn/runtime", () => ({readContentStyles: jest.fn()}));

const createRuntime = (files = ["first.css", "second.css"]): ContentScriptStylesRuntime => {
    const registry: Record<string, ContentScriptStylesRuntime> = {};

    new Function(
        "registry",
        renderIsolatedStylesRuntime({
            entry: "panel.content",
            require: "registry",
            property: "styles",
            timeout: 1000,
            initialStyles: files,
        })
    )(registry);

    registry.styles.initialize(file => `https://extension.test/${file}`);
    jest.mocked(readContentStyles).mockReturnValue(registry.styles);

    return registry.styles;
};

const createNode = (mode: "shadow" | "iframe" = "shadow") => {
    const anchor = document.createElement("article");
    document.body.append(anchor);

    const mount = jest.fn((anchor: Element, container: Element) => {
        anchor.append(container);
    });
    const host = new MountNode(new Node(anchor, document.createElement("section")), new ContainerRegistry(), mount);

    const setup = new IsolationSetup({
        props: () => ({anchor, data: undefined}),
        container: () => host.container,
        target: ({document}) => document.createElement("div"),
    });

    const isolated =
        mode === "shadow"
            ? new ShadowNode(host, {}, setup)
            : new FrameNode(
                  host,
                  {type: "iframe"},
                  () => {
                      node.mount();
                  },
                  setup
              );

    const render = jest.fn(() => "Styled UI");
    const onError = jest.fn();
    const renderer = new VanillaNode(
        isolated,
        render,
        () => ({
            anchor,
            container: isolated.container!,
            target: isolated.target!,
            boundary: isolated.boundary,
            data: undefined,
        }),
        {ready: () => isolated.ready()}
    );
    renderer.setErrorHandler(onError);

    const emitter = new EventEmitter();
    const events: ContentScriptEvent[] = [];
    emitter.on(event => events.push(event));
    const node = new EventNode(renderer, emitter, renderer);

    return {
        node,
        mount,
        onError,
        render,
        events,
        isolated,
        emitter,
        props: () => ({
            anchor,
            container: isolated.container!,
            target: isolated.target!,
            boundary: isolated.boundary,
            data: undefined,
        }),
    };
};

const links = (node: EventNode): HTMLLinkElement[] => {
    const root = node.target!.getRootNode() as ShadowRoot | Document;

    return Array.from(root.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
};

afterEach(() => {
    document.body.replaceChildren();
    jest.restoreAllMocks();
    jest.useRealTimers();
});

test("a renderer cleanup failure still unmounts the underlying host", () => {
    const failure = new Error("Renderer cleanup failed");
    const anchor = document.createElement("article");
    const container = document.createElement("section");
    document.body.append(anchor);
    const registry = new ContainerRegistry();
    const mounted = new MountNode(new Node(anchor, container), registry, (anchor, container) =>
        anchor.append(container)
    );

    class FailingNode extends VanillaNode {
        protected clear(): void {
            if (container.textContent) {
                throw failure;
            }
        }
    }

    const renderer = new FailingNode(
        mounted,
        () => "UI",
        () => ({anchor, container, target: container, boundary: undefined, data: undefined})
    );
    expect(renderer.mount()).toBe(true);
    expect(registry.owns(container)).toBe(true);
    expect(() => renderer.unmount()).toThrow(failure);
    expect(container.isConnected).toBe(false);
    expect(registry.owns(container)).toBe(false);
    expect(mounted.container).toBeUndefined();
});

test("requires an error handler before mounting a deferred renderer and accepts it after construction", async () => {
    createRuntime(["initial.css"]);
    const {isolated, props, render, onError, emitter, events} = createNode();
    const renderer = new VanillaNode(isolated, render, props, {ready: () => isolated.ready()});
    const node = new EventNode(renderer, emitter, renderer);

    try {
        expect(() => node.mount()).toThrow("Deferred content rendering requires an error handler before mount");
        expect(isolated.container?.isConnected).toBe(false);
        expect(render).not.toHaveBeenCalled();

        renderer.setErrorHandler(onError);
        expect(node.mount()).toBe(false);
        links(node)[0].dispatchEvent(new Event("load"));
        await waitFor(() => expect(events).toEqual([ContentScriptEvent.Mount]));
        expect(render).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
    } finally {
        node.unmount();
    }
});

test.each(["shadow", "iframe"] as const)(
    "%s invalidates pending render on unmount and awaits fresh links on remount",
    async mode => {
        createRuntime();
        const {node, render, events} = createNode(mode);

        try {
            expect(node.mount()).toBe(false);
            const oldTarget = node.target;
            const oldLinks = links(node);
            expect(node.unmount()).toBe(true);
            expect(node.mount()).toBe(false);
            expect(node.target).not.toBe(oldTarget);
            await act(async () => {
                for (const link of oldLinks) {
                    expect(link.onload).toBeNull();
                    expect(link.onerror).toBeNull();
                    link.dispatchEvent(new Event("load"));
                }
            });

            expect(render).not.toHaveBeenCalled();

            for (const link of links(node)) {
                link.dispatchEvent(new Event("load"));
            }

            await waitFor(() => expect(render).toHaveBeenCalledTimes(1));
            expect(events.filter(event => event === ContentScriptEvent.Mount)).toHaveLength(1);
        } finally {
            node.unmount();
        }
    }
);

test("a timeout releases links and timers without rendering, and the next mount can retry", async () => {
    jest.useFakeTimers();
    createRuntime(["stalled.css"]);
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const {node, render, events} = createNode();

    try {
        expect(node.mount()).toBe(false);
        await jest.advanceTimersByTimeAsync(1000);
        expect(render).not.toHaveBeenCalled();
        expect(events).toEqual([]);
        expect(links(node)).toEqual([]);
        expect(jest.getTimerCount()).toBe(0);
        expect(error.mock.calls[0][0]).toMatchObject({type: "timeout", request: "https://extension.test/stalled.css"});

        expect(node.mount()).toBe(false);
        links(node)[0].dispatchEvent(new Event("load"));
        await jest.advanceTimersByTimeAsync(0);
        expect(jest.getTimerCount()).toBe(0);
        expect(events).toEqual([ContentScriptEvent.Mount]);
    } finally {
        node.unmount();
    }
});

test("ready is idempotent, includes newly requested CSS, and does not preload future chunks", async () => {
    const runtime = createRuntime(["initial.css"]);
    const root = document.createElement("section").attachShadow({mode: "open"});
    runtime.add(root, null);

    try {
        const first = runtime.ready(root);
        const again = runtime.ready(root);
        expect(root.querySelectorAll("link")).toHaveLength(1);
        root.querySelector("link")!.dispatchEvent(new Event("load"));
        await Promise.all([first, again]);
        const lazy = runtime.load("https://extension.test/lazy.css");
        const later = runtime.ready(root);
        let ready = false;
        void later.then(() => {
            ready = true;
        });
        await Promise.resolve();
        expect(ready).toBe(false);
        expect(root.querySelectorAll("link")).toHaveLength(2);
        root.querySelectorAll("link")[1].dispatchEvent(new Event("load"));
        await Promise.all([lazy, later]);
        expect(ready).toBe(true);
    } finally {
        runtime.delete(root);
    }
});

test("iframe recovery invalidates pending CSS and waits for the new target without duplicate Mount events", async () => {
    createRuntime(["initial.css"]);
    const {node, render, events} = createNode("iframe");

    try {
        expect(node.mount()).toBe(false);
        const frame = node.boundary as HTMLIFrameElement;
        const target = node.target!;
        target.remove();
        await act(async () => {
            frame.dispatchEvent(new Event("load"));
        });
        expect(node.target).not.toBe(target);
        expect(render).not.toHaveBeenCalled();
        expect(node.mount()).toBe(false);
        await act(async () => {
            links(node)[0].dispatchEvent(new Event("load"));
        });
        await act(async () => {
            frame.dispatchEvent(new Event("load"));
        });
        expect(render).toHaveBeenCalledTimes(1);
        expect(events).toEqual([ContentScriptEvent.Mount]);
    } finally {
        node.unmount();
    }
});

test("React component, layout effects and effects start only after CSS is ready", async () => {
    createRuntime(["initial.css"]);
    const {isolated, emitter, events, props, onError} = createNode();
    const layout = jest.fn();
    const effect = jest.fn();
    const cleanup = jest.fn();

    const Panel = jest.fn(() => {
        useLayoutEffect(layout, []);
        useEffect(() => {
            effect();

            return cleanup;
        }, []);

        return createElement("span", null, "React UI");
    });

    const renderer = new ReactNode(isolated, () => createElement(Panel), props, {
        ready: () => isolated.ready(),
    });
    renderer.setErrorHandler(onError);
    const node = new EventNode(renderer, emitter, renderer);

    try {
        await act(() => {
            expect(node.mount()).toBe(false);
        });
        expect(Panel).not.toHaveBeenCalled();
        expect(layout).not.toHaveBeenCalled();
        expect(effect).not.toHaveBeenCalled();
        expect(events).toEqual([]);

        await act(async () => {
            links(node)[0].dispatchEvent(new Event("load"));
        });

        expect(node.target!.textContent).toBe("React UI");
        expect(layout).toHaveBeenCalledTimes(1);
        expect(effect).toHaveBeenCalledTimes(1);
        expect(events).toEqual([ContentScriptEvent.Mount]);
    } finally {
        await act(() => {
            node.unmount();
        });
    }

    expect(cleanup).toHaveBeenCalledTimes(1);
});

test("an empty CSS inventory needs no load events before rendering", async () => {
    createRuntime([]);
    const {node, render, events} = createNode();

    try {
        expect(node.mount()).toBe(false);
        await waitFor(() => expect(render).toHaveBeenCalledTimes(1));
        expect(links(node)).toEqual([]);
        expect(events).toEqual([ContentScriptEvent.Mount]);
    } finally {
        node.unmount();
    }
});

test("a removed anchor cannot render when pending styles finish", async () => {
    createRuntime(["initial.css"]);
    const {node, render, events} = createNode();

    try {
        expect(node.mount()).toBe(false);
        const [link] = links(node);
        node.anchor.remove();
        await act(async () => {
            link.dispatchEvent(new Event("load"));
        });
        expect(node.target).toBeUndefined();
        expect(render).not.toHaveBeenCalled();
        expect(events).toEqual([]);
    } finally {
        node.unmount();
    }
});

test.each(["shadow", "iframe"] as const)(
    "%s emits no Mount when the deferred render handler unmounts its own node",
    async mode => {
        createRuntime(["initial.css"]);
        const {node, render, events, onError} = createNode(mode);

        render.mockImplementationOnce(() => {
            node.unmount();

            return "Discarded UI";
        });

        try {
            expect(node.mount()).toBe(false);
            await act(async () => {
                links(node)[0].dispatchEvent(new Event("load"));
            });

            expect(render).toHaveBeenCalledTimes(1);
            expect(node.target).toBeUndefined();
            expect(node.anchor.textContent).toBe("");
            expect(events).toEqual([ContentScriptEvent.Unmount]);
            expect(onError).not.toHaveBeenCalled();
        } finally {
            node.unmount();
        }
    }
);

test("roots wait independently and removing a pending root clears its timers", async () => {
    jest.useFakeTimers();
    createRuntime(["initial.css"]);
    const first = createNode();
    const second = createNode();

    try {
        expect(first.node.mount()).toBe(false);
        expect(second.node.mount()).toBe(false);
        links(second.node)[0].dispatchEvent(new Event("load"));
        await jest.advanceTimersByTimeAsync(0);
        expect(first.render).not.toHaveBeenCalled();
        expect(second.render).toHaveBeenCalledTimes(1);
        expect(first.node.unmount()).toBe(true);
        await jest.advanceTimersByTimeAsync(0);
        expect(jest.getTimerCount()).toBe(0);
        expect(first.events).not.toContain(ContentScriptEvent.Mount);
    } finally {
        first.node.unmount();
        second.node.unmount();
    }
});

test.each(["shadow", "iframe"] as const)(
    "%s waits for initial and remembered lazy CSS and emits Mount once",
    async mode => {
        const runtime = createRuntime();
        await runtime.load("https://extension.test/lazy.css");
        const {node, render, events, mount, isolated} = createNode(mode);
        const mountNode = jest.spyOn(isolated, "mount");

        try {
            const mounting = node.mount();
            expect(mounting).toBe(false);
            expect(render).not.toHaveBeenCalled();
            expect(node.target!.textContent).toBe("");
            expect(events).toEqual([]);
            expect(node.mount()).toBe(mounting);
            const mountCalls = mountNode.mock.calls.length;
            const requested = links(node);
            expect(requested.map(link => link.href)).toEqual([
                "https://extension.test/first.css",
                "https://extension.test/second.css",
                "https://extension.test/lazy.css",
            ]);

            requested[1].dispatchEvent(new Event("load"));
            requested[0].dispatchEvent(new Event("load"));
            await Promise.resolve();
            expect(render).not.toHaveBeenCalled();
            requested[2].dispatchEvent(new Event("load"));
            await waitFor(() => expect(render).toHaveBeenCalledTimes(1));
            expect(mountNode).toHaveBeenCalledTimes(mountCalls);
            expect(mount).toHaveBeenCalledTimes(1);
            expect(render).toHaveBeenCalledTimes(1);
            expect(node.target!.textContent).toBe("Styled UI");
            expect(events).toEqual([ContentScriptEvent.Mount]);
            expect(node.mount()).toBe(false);
        } finally {
            node.unmount();
        }
    }
);

test("failed CSS leaves the target empty and retries only missing links in their original order", async () => {
    createRuntime();
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    const {node, render, events} = createNode();

    try {
        expect(node.mount()).toBe(false);
        const [first, second] = links(node);
        await act(async () => {
            second.dispatchEvent(new Event("load"));
            first.dispatchEvent(new Event("error"));
        });
        expect(render).not.toHaveBeenCalled();
        expect(events).toEqual([]);
        expect(first.isConnected).toBe(false);
        expect(error).toHaveBeenCalledTimes(1);
        expect(error.mock.calls[0][0]).toMatchObject({request: first.href, type: "error"});
        expect(String(error.mock.calls[0][0])).toContain("panel.content");

        expect(node.mount()).toBe(false);
        const current = links(node);
        expect(current.map(link => link.href)).toEqual([first.href, second.href]);
        expect(current[1]).toBe(second);
        current[0].dispatchEvent(new Event("load"));
        await waitFor(() => expect(render).toHaveBeenCalledTimes(1));
        expect(events).toEqual([ContentScriptEvent.Mount]);
    } finally {
        node.unmount();
    }
});
