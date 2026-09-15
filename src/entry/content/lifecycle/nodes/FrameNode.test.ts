import type {
    ContentScriptBoundaryHandler,
    ContentScriptBoundaryProps,
    ContentScriptTargetProps,
    ContentScriptIsolationFrameOptions,
} from "@typing/content";

import {FrameNode, Node, MountNode} from "./index";
import IsolationSetup from "../IsolationSetup";
import {getContentScriptStylesRuntime} from "./isolated-styles";

jest.mock("@addon-core/browser", () => ({getUrl: (file: string) => `chrome-extension://fixture/${file}`}));
jest.mock("#adnbn/page", () => ({aliases: {panel: "panel.html"}}));
jest.mock("./isolated-styles", () => ({getContentScriptStylesRuntime: jest.fn()}));

test("FrameNode explains a disconnected host and allows mounting again once the mounter connects it", () => {
    const runtime = {initialize: jest.fn(), add: jest.fn(), delete: jest.fn(), load: jest.fn()};
    jest.mocked(getContentScriptStylesRuntime).mockReturnValue(runtime);
    const anchor = document.createElement("section");
    const container = document.createElement("div");
    document.body.append(anchor);
    let connect = false;

    const mountedNode = new MountNode(new Node(anchor, container), (anchor, container) => {
        if (connect) {
            anchor.append(container);
        }
    });

    const node = new FrameNode(
        mountedNode,
        {type: "iframe"},
        () => {},
        new IsolationSetup<undefined, "iframe">({
            props: () => ({anchor, data: undefined}),
            container: () => mountedNode.container,
            target: ({document}) => document.createElement("section"),
        })
    );

    try {
        expect(() => node.mount()).toThrow(/container is not connected.*mount must attach/);
        expect(container.querySelector("iframe")).toBeNull();
        expect(runtime.add).not.toHaveBeenCalled();
        connect = true;
        expect(node.mount()).toBe(true);
        expect(node.target?.isConnected).toBe(true);
        expect(node.target?.tagName).toBe("SECTION");
        const frame = container.querySelector("iframe")!;
        expect(frame.getAttribute("style")).toBeNull();
        frame.contentDocument!.head.remove();
        expect(() => node.mount()).toThrow(/no accessible document/);
    } finally {
        node.unmount();
        anchor.remove();
    }
});

test("FrameNode does not require a connected host for document navigation", () => {
    const container = document.createElement("div");

    const createTarget = jest.fn(({document}: ContentScriptTargetProps<undefined, "iframe">) =>
        document.createElement("span")
    );

    const mountedNode = new Node(document.createElement("section"), container);

    const node = new FrameNode(
        mountedNode,
        {type: "iframe", src: "https://example.com"},
        () => {},
        new IsolationSetup<undefined, "iframe">({
            props: () => ({anchor: mountedNode.anchor, data: undefined}),
            container: () => mountedNode.container,
            target: createTarget,
        })
    );

    try {
        expect(node.mount()).toBe(true);
        expect(container.querySelector("iframe")?.src).toBe("https://example.com/");
        expect(node.boundary).toBe(container.querySelector("iframe"));
        expect(node.target).toBeUndefined();
        expect(createTarget).not.toHaveBeenCalled();
    } finally {
        node.unmount();
    }
});

test("FrameNode replaces lost targets, unregisters old styles and releases its load callback", async () => {
    const runtime = {initialize: jest.fn(), add: jest.fn(), delete: jest.fn(), load: jest.fn()};
    jest.mocked(getContentScriptStylesRuntime).mockReturnValue(runtime);
    const anchor = document.createElement("section");
    document.body.append(anchor);
    const recover = jest.fn();

    const factory = jest.fn(({boundary, document}: ContentScriptTargetProps<undefined, "iframe">) => {
        boundary.title = "Prepared frame";

        return document.createElement("section");
    });

    const mountedNode = new MountNode(new Node(anchor, document.createElement("div")), (anchor, container) => {
        anchor.append(container);
    });

    const node = new FrameNode(
        mountedNode,
        {type: "iframe"},
        recover,
        new IsolationSetup<undefined, "iframe">({
            props: () => ({anchor, data: undefined}),
            container: () => mountedNode.container,
            target: factory,
            boundary: ({boundary}) => {
                boundary.style.height = "320px";
            },
        })
    );

    node.mount();
    const frame = node.container!.querySelector("iframe")!;
    const target = node.target!;
    expect(frame.hasAttribute("src")).toBe(false);
    expect(frame.style.height).toBe("320px");
    expect(node.boundary).toBe(frame);
    expect(target.tagName).toBe("SECTION");
    expect(frame.title).toBe("Prepared frame");

    expect(factory).toHaveBeenCalledWith({
        anchor,
        data: undefined,
        container: node.container,
        boundary: frame,
        document: frame.contentDocument,
    });

    expect(target.ownerDocument).toBe(frame.contentDocument);
    expect(runtime.add).toHaveBeenLastCalledWith(frame.contentDocument!.head, null, false);
    // An initial load on an intact document does not start recovery or enable retries.
    frame.dispatchEvent(new Event("load"));
    await Promise.resolve();
    expect(recover).not.toHaveBeenCalled();
    node.mount();
    expect(factory).toHaveBeenCalledTimes(1);
    target.remove();
    frame.dispatchEvent(new Event("load"));
    await Promise.resolve();
    expect(recover).toHaveBeenCalledTimes(1);
    node.mount();
    expect(node.target).not.toBe(target);
    expect(node.boundary).toBe(frame);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(runtime.delete).toHaveBeenCalledTimes(1);
    expect(runtime.add).toHaveBeenLastCalledWith(frame.contentDocument!.head, null, true);
    node.unmount();
    expect(node.boundary).toBeUndefined();
    frame.dispatchEvent(new Event("load"));
    await Promise.resolve();
    expect(recover).toHaveBeenCalledTimes(1);
    node.mount();
    expect(node.container!.querySelector("iframe")).not.toBe(frame);
    expect(runtime.add).toHaveBeenLastCalledWith(node.target!.ownerDocument!.head, null, false);
    node.unmount();
    anchor.remove();
});

test.each(["throw", "unmount"])("FrameNode cleans up when target creation triggers %s", action => {
    const runtime = {initialize: jest.fn(), add: jest.fn(), delete: jest.fn(), load: jest.fn()};
    jest.mocked(getContentScriptStylesRuntime).mockReturnValue(runtime);
    const anchor = document.createElement("section");
    document.body.append(anchor);

    const mountedNode = new MountNode(new Node(anchor, document.createElement("div")), (anchor, container) =>
        anchor.append(container)
    );

    const node = new FrameNode(
        mountedNode,
        {type: "iframe"},
        () => {},
        new IsolationSetup<undefined, "iframe">({
            props: () => ({anchor, data: undefined}),
            container: () => mountedNode.container,
            target: ({document}) => {
                if (action === "throw") {
                    throw new Error("Target failed");
                }

                node.unmount();

                return document.createElement("span");
            },
        })
    );

    try {
        if (action === "throw") {
            expect(() => node.mount()).toThrow("Target failed");
        } else {
            expect(node.mount()).toBe(false);
        }

        expect(node.boundary).toBeUndefined();
        expect(node.target).toBeUndefined();
        expect(anchor.childElementCount).toBe(0);
        expect(runtime.add).not.toHaveBeenCalled();
    } finally {
        node.unmount();
        anchor.remove();
    }
});

const createBoundaryNode = (
    boundary: ContentScriptBoundaryHandler<undefined, "iframe">,
    options: ContentScriptIsolationFrameOptions = {type: "iframe"},
    target: (props: ContentScriptTargetProps<undefined, "iframe">) => Element = jest.fn(
        ({document}: ContentScriptTargetProps<undefined, "iframe">) => document.createElement("section")
    )
) => {
    const runtime = {initialize: jest.fn(), add: jest.fn(), delete: jest.fn(), load: jest.fn()};
    jest.mocked(getContentScriptStylesRuntime).mockReturnValue(runtime);

    const mountedNode = new MountNode(
        new Node(document.body, document.createElement("section")),
        (anchor, container) => {
            anchor.append(container);
        }
    );

    const node = new FrameNode(
        mountedNode,
        options,
        () => node.mount(),
        new IsolationSetup<undefined, "iframe">({
            props: () => ({anchor: mountedNode.anchor, data: undefined}),
            container: () => mountedNode.container,
            boundary,
            target,
        })
    );

    return {node, runtime, target};
};

test.each<ContentScriptIsolationFrameOptions>([
    {type: "iframe"},
    {type: "iframe", page: "panel"},
    {type: "iframe", src: "https://example.com/panel"},
])("FrameNode configures %j before insertion and navigation", options => {
    const load = jest.fn();
    const cleanup = jest.fn();

    const setup = jest.fn(({boundary: frame}: ContentScriptBoundaryProps<undefined, "iframe">) => {
        expect(frame.getAttribute("style")).toBeNull();
        expect(frame.hasAttribute("src")).toBe(false);
        expect(frame.isConnected).toBe(false);
        frame.style.height = "234px";
        frame.style.border = "2px solid red";
        frame.addEventListener("load", load);
        expect(node.mount()).toBe(false);

        return () => {
            expect(frame.isConnected).toBe(true);
            expect(node.target).toBeUndefined();
            frame.removeEventListener("load", load);
            cleanup();
        };
    });

    const {node, target} = createBoundaryNode(setup, options);

    try {
        expect(node.mount()).toBe(true);
        const frame = node.boundary!;
        expect(frame.style.height).toBe("234px");
        expect(frame.style.borderTopWidth).toBe("2px");

        expect(frame.getAttribute("src")).toBe(
            options.page ? "chrome-extension://fixture/panel.html" : (options.src ?? null)
        );

        frame.dispatchEvent(new Event("load"));
        expect(load).toHaveBeenCalledTimes(1);
        node.mount();
        expect(setup).toHaveBeenCalledTimes(1);

        if (!options.page && !options.src) {
            node.target!.remove();
            node.mount();
            expect(setup).toHaveBeenCalledTimes(1);
            expect(target).toHaveBeenCalledTimes(2);
            expect(cleanup).not.toHaveBeenCalled();
        } else {
            expect(target).not.toHaveBeenCalled();
        }

        node.unmount();
        node.unmount();
        frame.dispatchEvent(new Event("load"));
        expect(load).toHaveBeenCalledTimes(1);
        expect(cleanup).toHaveBeenCalledTimes(1);
        node.mount();
        expect(setup).toHaveBeenCalledTimes(2);
        expect(node.boundary).not.toBe(frame);
    } finally {
        node.unmount();
    }

    expect(cleanup).toHaveBeenCalledTimes(2);
});

test.each(["setup", "target", "unmount"])("FrameNode releases partial setup after %s", action => {
    const cleanup = jest.fn();
    let frame: HTMLIFrameElement | undefined;

    const {node, runtime} = createBoundaryNode(
        ({boundary}) => {
            frame = boundary;

            if (action === "setup") {
                throw new Error("Setup failed");
            }

            if (action === "unmount") {
                node.unmount();
            }

            return cleanup;
        },
        action === "unmount" ? {type: "iframe", src: "https://example.com"} : {type: "iframe"},
        jest.fn(() => {
            throw new Error("Target failed");
        })
    );

    if (action === "unmount") {
        expect(node.mount()).toBe(false);
        expect(frame?.hasAttribute("src")).toBe(false);
    } else {
        expect(() => node.mount()).toThrow(action === "setup" ? "Setup failed" : "Target failed");
    }

    expect(frame?.isConnected).toBe(false);
    expect(node.container).toBeUndefined();
    expect(node.boundary).toBeUndefined();
    expect(runtime.add).not.toHaveBeenCalled();
    node.unmount();
    expect(cleanup).toHaveBeenCalledTimes(action === "setup" ? 0 : 1);
});
