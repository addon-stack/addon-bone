import ContainerRegistry from "./ContainerRegistry";

test("owns registered containers and their descendants until released", () => {
    const registry = new ContainerRegistry();
    const container = document.createElement("section");
    const anchor = document.createElement("article");
    const text = document.createTextNode("UI");
    container.append(text);

    expect(registry.owns(text)).toBe(false);
    const unregister = registry.register(container, anchor);
    expect(registry.owns(container)).toBe(true);
    expect(registry.owns(text)).toBe(true);
    expect(registry.owns(anchor)).toBe(false);

    unregister();
    unregister();
    expect(registry.owns(text)).toBe(false);
});

test.each([false, true])("releases only its own registration (same anchor: %s)", sameAnchor => {
    const registry = new ContainerRegistry();
    const container = document.createElement("section");
    const anchor = document.createElement("article");
    const first = registry.register(container, anchor);
    const second = registry.register(container, sameAnchor ? anchor : document.createElement("article"));

    first();
    first();
    expect(registry.owns(container)).toBe(true);
    second();
    expect(registry.owns(container)).toBe(false);
});

test("cleanup from before clear cannot remove a new registration", () => {
    const registry = new ContainerRegistry();
    const container = document.createElement("section");
    const anchor = document.createElement("article");
    const stale = registry.register(container, anchor);
    registry.clear();
    expect(registry.owns(container)).toBe(false);
    const current = registry.register(container, anchor);

    stale();
    expect(registry.owns(container)).toBe(true);
    current();
    expect(registry.owns(container)).toBe(false);
});

test("checks wrapping anchors at query time across all registrations", () => {
    const registry = new ContainerRegistry();
    const container = document.createElement("section");
    const anchor = document.createElement("article");
    registry.register(container, document.createElement("article"));
    const unregister = registry.register(container, anchor);
    expect(registry.owns(container)).toBe(true);

    container.append(anchor);
    expect(registry.owns(anchor)).toBe(false);
    expect(registry.owns(container)).toBe(false);
    anchor.remove();
    expect(registry.owns(container)).toBe(true);

    container.append(anchor);
    unregister();
    expect(registry.owns(container)).toBe(true);
});

test.each(["open", "closed"] as const)("crosses nested %s shadow roots", mode => {
    const registry = new ContainerRegistry();
    const container = document.createElement("section");
    const root = container.attachShadow({mode});
    const nested = document.createElement("div");
    root.append(nested);
    const nestedRoot = nested.attachShadow({mode});
    const text = document.createTextNode("UI");
    nestedRoot.append(text);
    const unregister = registry.register(container, document.createElement("article"));

    expect(registry.owns(text)).toBe(true);
    expect(registry.owns(root)).toBe(true);
    unregister();
    expect(registry.owns(text)).toBe(false);
});

test("does not traverse the DOM for an empty registry", () => {
    const registry = new ContainerRegistry();
    const target = document.createTextNode("Page");
    const parent = jest.spyOn(target, "parentNode", "get");

    expect(registry.owns(target)).toBe(false);
    expect(parent).not.toHaveBeenCalled();
    parent.mockRestore();
});

test("stops at an iframe document but owns the registered frame host", () => {
    const registry = new ContainerRegistry();
    const host = document.createElement("section");
    const iframe = document.createElement("iframe");
    host.append(iframe);
    document.body.append(host);
    registry.register(host, document.createElement("article"));

    try {
        expect(registry.owns(iframe)).toBe(true);
        expect(registry.owns(iframe.contentDocument!.body)).toBe(false);
    } finally {
        host.remove();
    }
});
