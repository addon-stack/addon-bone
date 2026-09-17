import {ContainerRegistry} from "../context";
import {MountNode, Node} from "./index";

afterEach(() => {
    document.body.replaceChildren();
});

test("a failed mounter rolls back its registration and allows retry", () => {
    const registry = new ContainerRegistry();
    const anchor = document.createElement("article");
    const container = document.createElement("section");
    document.body.append(anchor);
    let fail = true;

    const node = new MountNode(new Node(anchor, container), registry, (anchor, container) => {
        if (fail) {
            throw new Error("Mount failed");
        }

        anchor.append(container);
    });

    expect(() => node.mount()).toThrow("Mount failed");
    expect(registry.owns(container)).toBe(false);
    fail = false;
    expect(node.mount()).toBe(true);
    expect(registry.owns(container)).toBe(true);
    node.unmount();
    expect(registry.owns(container)).toBe(false);
});

test("synchronous cancellation inside the mounter releases even late returned cleanup", () => {
    const registry = new ContainerRegistry();
    const anchor = document.createElement("article");
    const container = document.createElement("section");
    const cleanup = jest.fn();
    document.body.append(anchor);

    const node = new MountNode(new Node(anchor, container), registry, (anchor, container) => {
        anchor.append(container);
        node.unmount();
        expect(registry.owns(container)).toBe(false);

        return cleanup;
    });

    expect(node.mount()).toBe(false);
    expect(registry.owns(container)).toBe(false);
    expect(container.isConnected).toBe(false);
    expect(cleanup).toHaveBeenCalledTimes(1);
    node.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
});

test.each(["return", "throw"])("a stale mount cannot unregister a reentrant remount on %s", outcome => {
    const registry = new ContainerRegistry();
    const anchor = document.createElement("article");
    const container = document.createElement("section");
    const staleCleanup = jest.fn();
    const currentCleanup = jest.fn();
    document.body.append(anchor);
    let first = true;

    const node = new MountNode(new Node(anchor, container), registry, (anchor, container) => {
        anchor.append(container);

        if (!first) {
            return currentCleanup;
        }

        first = false;
        node.unmount();
        node.mount();

        if (outcome === "throw") {
            throw new Error("Stale mount failed");
        }

        return staleCleanup;
    });

    if (outcome === "throw") {
        expect(() => node.mount()).toThrow("Stale mount failed");
    } else {
        expect(node.mount()).toBe(false);
        expect(staleCleanup).toHaveBeenCalledTimes(1);
    }

    expect(node.container).not.toBe(container);
    expect(registry.owns(container)).toBe(false);
    expect(registry.owns(node.container!)).toBe(true);
    expect(currentCleanup).not.toHaveBeenCalled();
    node.unmount();
    expect(currentCleanup).toHaveBeenCalledTimes(1);
});

test("throwing cleanup still removes the host and cannot remount it during unmount", () => {
    const registry = new ContainerRegistry();
    const anchor = document.createElement("article");
    const container = document.createElement("section");
    document.body.append(anchor);

    const node = new MountNode(new Node(anchor, container), registry, (anchor, container) => {
        anchor.append(container);

        return () => {
            expect(registry.owns(container)).toBe(false);
            expect(node.mount()).toBe(false);
            expect(node.unmount()).toBe(false);

            throw new Error("Cleanup failed");
        };
    });

    node.mount();
    expect(() => node.unmount()).toThrow("Cleanup failed");
    expect(container.isConnected).toBe(false);
    expect(registry.owns(container)).toBe(false);
    expect(node.container).toBeUndefined();
    expect(node.unmount()).toBe(false);
});

test("a shared container keeps the other mount registration when one node unmounts", () => {
    const registry = new ContainerRegistry();
    const container = document.createElement("section");
    const first = new MountNode(new Node(document.createElement("article"), container), registry, () => {});
    const second = new MountNode(new Node(document.createElement("article"), container), registry, () => {});
    first.mount();
    second.mount();

    first.unmount();
    expect(registry.owns(container)).toBe(true);
    second.unmount();
    expect(registry.owns(container)).toBe(false);
});

test("registers before the mounter and releases before its cleanup", () => {
    const registry = new ContainerRegistry();
    const anchor = document.createElement("article");
    const container = document.createElement("section");
    document.body.append(anchor);
    const cleanup = jest.fn(() => {
        expect(registry.owns(container)).toBe(false);
        expect(container.isConnected).toBe(true);
    });

    const node = new MountNode(new Node(anchor, container), registry, (anchor, container) => {
        expect(registry.owns(container)).toBe(true);
        anchor.append(container);

        return cleanup;
    });

    expect(node.mount()).toBe(true);
    expect(node.unmount()).toBe(true);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(container.isConnected).toBe(false);
    node.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
});
