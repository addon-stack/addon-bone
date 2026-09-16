import {MountNode, Node, ShadowNode} from "./index";
import IsolationSetup from "../IsolationSetup";
import {getContentScriptStylesRuntime} from "./isolated-styles";

import {
    ContentScriptShadowMode,
    type ContentScriptShadowOptions,
    type ContentScriptStylesRuntime,
    type ContentScriptBoundaryHandler,
    type ContentScriptBoundaryProps,
    type ContentScriptTargetProps,
} from "@typing/content";

jest.mock("./isolated-styles", () => ({
    getContentScriptStylesRuntime: jest.fn(),
}));

const createNode = (
    runtime: ContentScriptStylesRuntime,
    host = document.createElement("section"),
    options?: ContentScriptShadowOptions,
    target: (props: ContentScriptTargetProps<undefined, "shadow">) => Element = ({document}) =>
        document.createElement("span"),
    boundary?: ContentScriptBoundaryHandler<undefined, "shadow">
) => {
    const anchor = document.createElement("div");
    document.body.appendChild(anchor);
    jest.mocked(getContentScriptStylesRuntime).mockReturnValue(runtime);

    const mountedNode = new MountNode(new Node(anchor, host), (_anchor, container) => {
        anchor.appendChild(container);
    });

    const setup = new IsolationSetup<undefined, "shadow">({
        props: () => ({anchor, data: undefined}),
        container: () => mountedNode.container,
        boundary,
        target,
    });

    return {
        anchor,
        host,
        node: new ShadowNode(mountedNode, options, setup),
    };
};

describe("ShadowNode", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        jest.clearAllMocks();
    });

    test.each([undefined, {}, {mode: ContentScriptShadowMode.Open}, {mode: ContentScriptShadowMode.Closed}])(
        "registers the root and exposes the target with options %j",
        options => {
            const runtime: ContentScriptStylesRuntime = {
                initialize: jest.fn(),
                add: jest.fn(),
                ready: jest.fn(async () => undefined),
                delete: jest.fn(),
                load: jest.fn(async () => undefined),
            };

            const {host, node} = createNode(runtime, undefined, options);

            expect(node.mount()).toBe(true);
            const root = node.target!.getRootNode() as ShadowRoot;
            expect(root.mode).toBe(options?.mode ?? ContentScriptShadowMode.Open);
            expect(host.shadowRoot).toBe(options?.mode === ContentScriptShadowMode.Closed ? null : root);
            expect(node.target).toBe(root.lastElementChild);
            expect(node.target).not.toBe(host);
            expect(node.boundary).toBe(root);
            expect(runtime.add).toHaveBeenCalledWith(root, node.target);
            expect(Array.from(root.children).map(element => element.tagName)).toEqual(["SPAN"]);

            node.mount();
            expect(runtime.add).toHaveBeenCalledTimes(1);
        }
    );

    test.each([ContentScriptShadowMode.Open, ContentScriptShadowMode.Closed])(
        "unregisters %s before removing the host and creates a new root on remount",
        mode => {
            const states: boolean[] = [];

            const runtime: ContentScriptStylesRuntime = {
                initialize: jest.fn(),
                add: jest.fn(),
                ready: jest.fn(async () => undefined),
                delete: jest.fn(root => states.push((root as ShadowRoot).host.isConnected)),
                load: jest.fn(async () => undefined),
            };

            const {anchor, node} = createNode(runtime, undefined, {mode});

            node.mount();
            const firstHost = node.container;
            const firstRoot = node.target!.getRootNode();

            expect(node.unmount()).toBe(true);
            expect(states).toEqual([true]);
            expect(runtime.delete).toHaveBeenCalledWith(firstRoot);
            expect(node.target).toBeUndefined();
            expect(node.boundary).toBeUndefined();
            expect(firstHost?.isConnected).toBe(false);

            expect(node.mount()).toBe(true);
            expect(node.container).not.toBe(firstHost);
            const nextRoot = node.target!.getRootNode() as ShadowRoot;
            expect(nextRoot).not.toBe(firstRoot);
            expect(nextRoot.mode).toBe(mode);
            expect(node.target?.parentNode).toBe(nextRoot);
            expect(anchor.contains(node.container ?? null)).toBe(true);
            expect(runtime.add).toHaveBeenCalledTimes(2);
        }
    );

    test("creates a custom target per mount with access to a closed root", () => {
        const runtime = {
            initialize: jest.fn(),
            add: jest.fn(),
            ready: jest.fn(async () => undefined),
            delete: jest.fn(),
            load: jest.fn(),
        };

        const factory = jest.fn(({boundary, document}: ContentScriptTargetProps<undefined, "shadow">) => {
            expect(boundary.mode).toBe("closed");

            return document.createElement("span");
        });

        const {node} = createNode(runtime, undefined, {mode: "closed"}, factory);

        try {
            node.mount();
            const target = node.target;
            const boundary = node.boundary;
            expect(target?.tagName).toBe("SPAN");
            expect(target?.parentNode).toBe(boundary);

            expect(factory).toHaveBeenCalledWith({
                anchor: node.anchor,
                data: undefined,
                container: node.container,
                boundary,
                document,
            });

            node.mount();
            expect(factory).toHaveBeenCalledTimes(1);
            node.unmount();
            node.mount();
            expect(factory).toHaveBeenCalledTimes(2);
            expect(node.target).not.toBe(target);
            expect(node.boundary).not.toBe(boundary);
        } finally {
            node.unmount();
        }
    });

    test("releases the host when target creation fails and can mount a fresh root", () => {
        const runtime = {
            initialize: jest.fn(),
            add: jest.fn(),
            ready: jest.fn(async () => undefined),
            delete: jest.fn(),
            load: jest.fn(),
        };

        const factory = jest.fn(({document}: ContentScriptTargetProps<undefined, "shadow">) =>
            document.createElement("span")
        );

        factory.mockImplementationOnce(() => {
            throw new Error("Target failed");
        });

        const {node, host} = createNode(runtime, undefined, undefined, factory);

        expect(() => node.mount()).toThrow("Target failed");
        expect(host.isConnected).toBe(false);
        expect(node.boundary).toBeUndefined();
        expect(node.target).toBeUndefined();
        expect(runtime.add).not.toHaveBeenCalled();

        try {
            expect(node.mount()).toBe(true);
            expect(node.target?.isConnected).toBe(true);
        } finally {
            node.unmount();
        }
    });

    test("does not register a root unmounted by the target factory", () => {
        const runtime = {
            initialize: jest.fn(),
            add: jest.fn(),
            ready: jest.fn(async () => undefined),
            delete: jest.fn(),
            load: jest.fn(),
        };

        const {node} = createNode(runtime, undefined, undefined, ({document}) => {
            node.unmount();

            return document.createElement("span");
        });

        expect(node.mount()).toBe(false);
        expect(node.boundary).toBeUndefined();
        expect(node.target).toBeUndefined();
        expect(runtime.add).not.toHaveBeenCalled();
    });

    test.each([ContentScriptShadowMode.Open, ContentScriptShadowMode.Closed])(
        "preserves event propagation while encapsulating the %s event path",
        mode => {
            const runtime: ContentScriptStylesRuntime = {
                initialize: jest.fn(),
                add: jest.fn(),
                ready: jest.fn(async () => undefined),
                delete: jest.fn(),
                load: jest.fn(async () => undefined),
            };

            const {host, node} = createNode(runtime, undefined, {mode});
            node.mount();
            const button = document.createElement("button");
            node.target!.appendChild(button);
            let eventPath: EventTarget[] = [];

            host.addEventListener("click", event => {
                eventPath = event.composedPath();
            });

            button.click();
            expect(eventPath).toContain(host);
            expect(eventPath.includes(button)).toBe(mode === ContentScriptShadowMode.Open);
        }
    );

    test("rejects a container with an existing open ShadowRoot", () => {
        const runtime: ContentScriptStylesRuntime = {
            initialize: jest.fn(),
            add: jest.fn(),
            ready: jest.fn(async () => undefined),
            delete: jest.fn(),
            load: jest.fn(async () => undefined),
        };

        const host = document.createElement("section");
        host.attachShadow({mode: "open"});
        const {node} = createNode(runtime, host);

        expect(() => node.mount()).toThrow("Content script container already has an open ShadowRoot");
        expect(runtime.add).not.toHaveBeenCalled();
    });

    test("reports an existing closed root without exposing it or registering styles", () => {
        const runtime: ContentScriptStylesRuntime = {
            initialize: jest.fn(),
            add: jest.fn(),
            ready: jest.fn(async () => undefined),
            delete: jest.fn(),
            load: jest.fn(async () => undefined),
        };

        const host = document.createElement("section");
        host.attachShadow({mode: ContentScriptShadowMode.Closed});
        const {node} = createNode(runtime, host, {mode: ContentScriptShadowMode.Closed});
        expect(() => node.mount()).toThrow(/Cannot attach ShadowRoot/);
        expect(runtime.add).not.toHaveBeenCalled();
        expect(node.target).toBeUndefined();
    });
});

test("ShadowNode sets up each closed boundary once and cleans subscriptions before removing it", () => {
    const runtime = {
        initialize: jest.fn(),
        add: jest.fn(),
        ready: jest.fn(async () => undefined),
        delete: jest.fn(),
        load: jest.fn(),
    };
    const calls: string[] = [];
    const cleanup = jest.fn();

    const setup = jest.fn(({boundary: root}: ContentScriptBoundaryProps<undefined, "shadow">) => {
        calls.push("boundary");
        expect(root.mode).toBe("closed");
        expect(root.childNodes.length).toBe(0);

        return () => {
            expect(root.host.isConnected).toBe(true);
            cleanup();
        };
    });

    const target = jest.fn(({document}: ContentScriptTargetProps<undefined, "shadow">) => {
        calls.push("target");

        return document.createElement("section");
    });

    const {node} = createNode(runtime, undefined, {mode: "closed"}, target, setup);

    try {
        node.mount();
        const root = node.boundary;
        node.mount();
        expect(calls).toEqual(["boundary", "target"]);
        node.unmount();
        node.unmount();
        expect(cleanup).toHaveBeenCalledTimes(1);
        node.mount();
        expect(node.boundary).not.toBe(root);
        expect(setup).toHaveBeenCalledTimes(2);
    } finally {
        node.unmount();
    }

    expect(cleanup).toHaveBeenCalledTimes(2);
});

test.each(["setup", "target", "unmount"])("ShadowNode releases boundary resources after %s", action => {
    const runtime = {
        initialize: jest.fn(),
        add: jest.fn(),
        ready: jest.fn(async () => undefined),
        delete: jest.fn(),
        load: jest.fn(),
    };
    const cleanup = jest.fn();

    const {node} = createNode(
        runtime,
        undefined,
        undefined,
        ({document}) => {
            if (action === "target") {
                throw new Error("Target failed");
            }

            return document.createElement("section");
        },
        () => {
            expect(node.mount()).toBe(false);

            if (action === "setup") {
                throw new Error("Setup failed");
            }

            if (action === "unmount") {
                node.unmount();
                expect(node.mount()).toBe(false);
            }

            return cleanup;
        }
    );

    if (action === "unmount") {
        expect(node.mount()).toBe(false);
    } else {
        expect(() => node.mount()).toThrow(action === "setup" ? "Setup failed" : "Target failed");
    }

    expect(node.boundary).toBeUndefined();
    expect(node.container).toBeUndefined();
    expect(runtime.add).not.toHaveBeenCalled();
    node.unmount();
    expect(cleanup).toHaveBeenCalledTimes(action === "setup" ? 0 : 1);
});
