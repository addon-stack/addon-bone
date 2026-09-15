import type {ContentScriptBoundaryHandler, ContentScriptTargetProps} from "@typing/content";

import IsolationSetup from "./IsolationSetup";
import {Node} from "./nodes";
import {createTargetResolver} from "../resolvers/target";

test("IsolationSetup reads current props and the replacement container after remount", () => {
    const anchor = document.createElement("article");
    const node = new Node(anchor, document.createElement("section"));
    let data = {title: "First"};
    const boundary = jest.fn();

    const target = jest.fn(({document, data}: ContentScriptTargetProps<{title: string}>) => {
        const element = document.createElement("span");
        element.textContent = data.title;

        return element;
    });

    const setup = new IsolationSetup({
        props: () => ({anchor, data}),
        container: () => node.container,
        boundary,
        target: createTargetResolver(target),
    });

    const firstContainer = node.container!;
    const firstRoot = firstContainer.attachShadow({mode: "closed"});
    setup.setup(firstRoot);
    expect(setup.createTarget(firstRoot, document).textContent).toBe("First");
    node.unmount();
    node.mount();
    data = {title: "Second"};

    const container = node.container!;
    const root = container.attachShadow({mode: "closed"});
    setup.setup(root);
    const element = setup.createTarget(root, document);

    expect(container).not.toBe(firstContainer);
    expect(boundary).toHaveBeenLastCalledWith({anchor, data, container, boundary: root});
    expect(target).toHaveBeenLastCalledWith({anchor, data, container, boundary: root, document});
    expect(element.textContent).toBe("Second");
    expect(element.parentNode).toBeNull();
    node.unmount();
});

test("IsolationSetup uses each supplied document without repeating boundary setup or cleanup", () => {
    const container = document.createElement("section");
    const frame = document.createElement("iframe");
    const cleanup = jest.fn();
    const boundary = jest.fn(() => cleanup);

    const setup = new IsolationSetup({
        props: () => ({anchor: document.body, data: undefined}),
        container: () => container,
        boundary,
        target: createTargetResolver("section"),
    });

    const dispose = setup.setup(frame);
    const firstDocument = document.implementation.createHTMLDocument("first");
    const nextDocument = document.implementation.createHTMLDocument("next");
    const first = setup.createTarget(frame, firstDocument);
    const next = setup.createTarget(frame, nextDocument);

    expect(first.ownerDocument).toBe(firstDocument);
    expect(next.ownerDocument).toBe(nextDocument);
    expect(next).not.toBe(first);
    expect(boundary).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();
    dispose?.();
    expect(cleanup).toHaveBeenCalledTimes(1);
});

test.each(["boundary", "target"] as const)("IsolationSetup rejects a missing container during %s", stage => {
    const boundary = jest.fn();
    const target = jest.fn(({document}: ContentScriptTargetProps) => document.createElement("div"));

    const setup = new IsolationSetup({
        props: () => ({anchor: document.body, data: undefined}),
        container: () => undefined,
        boundary,
        target,
    });

    const frame = document.createElement("iframe");
    const invoke = () => (stage === "boundary" ? setup.setup(frame) : setup.createTarget(frame, document));

    expect(invoke).toThrow(`Content script ${stage} requires a mounted container`);
    expect(boundary).not.toHaveBeenCalled();
    expect(target).not.toHaveBeenCalled();
});

test.each([
    {name: "a Promise", result: () => Promise.resolve()},
    {name: "an element", result: () => document.createElement("div")},
])("IsolationSetup rejects $name returned instead of a cleanup function", ({result}) => {
    const container = document.createElement("section");

    const setup = new IsolationSetup({
        props: () => ({anchor: document.body, data: undefined}),
        container: () => container,
        boundary: result as unknown as ContentScriptBoundaryHandler<undefined>,
        target: createTargetResolver(),
    });

    expect(() => setup.setup(document.createElement("iframe"))).toThrow(
        "Content script boundary must return synchronously with a cleanup function or undefined"
    );
});

test("IsolationSetup logs cleanup errors when the owning node invokes the returned function", () => {
    const error = new Error("Cleanup failed");
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});
    const container = document.createElement("section");

    const setup = new IsolationSetup({
        props: () => ({anchor: document.body, data: undefined}),
        container: () => container,
        boundary: () => () => {
            throw error;
        },
        target: createTargetResolver(),
    });

    try {
        const cleanup = setup.setup(document.createElement("iframe"));
        expect(logged).not.toHaveBeenCalled();
        expect(() => cleanup?.()).not.toThrow();
        expect(logged).toHaveBeenCalledWith("Content script boundary cleanup failed", error);
    } finally {
        logged.mockRestore();
    }
});
