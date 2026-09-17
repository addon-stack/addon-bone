import {createAwaitFirstStrategy, createMutationObserverStrategy} from "../../../content";
import {EventEmitter, ManagedContext} from "../lifecycle/context";
import Node from "../lifecycle/nodes/Node";
import MountNode from "../lifecycle/nodes/MountNode";
import type {ContentScriptContext} from "@typing/content";

describe("content watch strategies", () => {
    afterEach(() => {
        jest.useRealTimers();
        document.body.replaceChildren();
    });

    test("observes the document element before body exists", () => {
        const body = document.body;
        const observe = jest.spyOn(MutationObserver.prototype, "observe");

        body.remove();

        try {
            const unwatch = createMutationObserverStrategy()(jest.fn(), new ManagedContext(new EventEmitter()));

            expect(observe).toHaveBeenCalledWith(
                document.documentElement,
                expect.objectContaining({childList: true, subtree: true})
            );

            unwatch();
        } finally {
            document.documentElement.append(body);
            observe.mockRestore();
        }
    });

    test("observes configured mutations and cancels pending updates on unsubscribe", async () => {
        jest.useFakeTimers();
        const element = document.createElement("span");
        document.body.append(element);
        const update = jest.fn();
        const context = new ManagedContext(new EventEmitter());

        const unwatch = createMutationObserverStrategy({
            childList: false,
            characterData: false,
            attributeFilter: ["data-state"],
        })(update, context);

        try {
            element.setAttribute("data-ignored", "1");
            await Promise.resolve();
            jest.advanceTimersByTime(201);
            expect(update).not.toHaveBeenCalled();

            element.setAttribute("data-state", "ready");
            await Promise.resolve();
            jest.advanceTimersByTime(201);
            expect(update).toHaveBeenCalledTimes(1);

            element.setAttribute("data-state", "pending");
            await Promise.resolve();
            unwatch();
            jest.advanceTimersByTime(201);
            element.setAttribute("data-state", "unsubscribed");
            await Promise.resolve();
            jest.advanceTimersByTime(201);
            expect(update).toHaveBeenCalledTimes(1);
        } finally {
            unwatch();
        }
    });

    test("default watching ignores attribute and character-data changes but observes added elements", async () => {
        jest.useFakeTimers();
        const element = document.createElement("span");
        element.textContent = "initial";
        document.body.append(element);
        const update = jest.fn();
        const context = new ManagedContext(new EventEmitter());
        const unwatch = createMutationObserverStrategy()(update, context);

        try {
            element.className = "ready";
            element.firstChild!.nodeValue = "changed";
            await jest.advanceTimersByTimeAsync(201);
            expect(update).not.toHaveBeenCalled();

            element.append(document.createElement("strong"));
            await jest.advanceTimersByTimeAsync(201);
            expect(update).toHaveBeenCalledTimes(1);
        } finally {
            unwatch();
        }
    });

    test("processes continuous mutations without waiting for a quiet period", async () => {
        jest.useFakeTimers();
        const update = jest.fn();
        const context = new ManagedContext(new EventEmitter());
        const unwatch = createMutationObserverStrategy()(update, context);

        try {
            for (let window = 1; window <= 2; window++) {
                for (let mutation = 0; mutation < 4; mutation++) {
                    document.body.append(document.createElement("span"));
                    await Promise.resolve();
                    await jest.advanceTimersByTimeAsync(50);
                }

                expect(update).toHaveBeenCalledTimes(window);
            }

            document.body.append(document.createElement("span"));
            await Promise.resolve();
            unwatch();
            await jest.advanceTimersByTimeAsync(201);
            expect(update).toHaveBeenCalledTimes(2);
        } finally {
            unwatch();
        }
    });

    test.each(["owned", "existing", "wrapping"])("filters only exclusive UI in a %s container", async kind => {
        jest.useFakeTimers();
        const anchor = document.createElement("article");
        const container = document.createElement("section");
        const text = document.createTextNode("initial");
        container.append(text);
        document.body.append(anchor);

        if (kind === "existing") {
            document.body.append(container);
        }

        const mounter = jest.fn((anchor: Element, container: Element) => {
            if (kind === "wrapping") {
                anchor.before(container);
                container.append(anchor);
            } else {
                anchor.append(container);
            }
        });

        const context = new ManagedContext(new EventEmitter());
        const node = new MountNode(new Node(anchor, container), context.containers, mounter);
        context.add(node);
        context.mount();
        const update = jest.fn();
        const unwatch = createMutationObserverStrategy({attributes: true, characterData: true})(update, context);

        try {
            expect(mounter).toHaveBeenCalledTimes(kind === "existing" ? 0 : 1);
            expect(context.owns(container)).toBe(kind === "owned");
            container.append(document.createElement("span"));
            container.setAttribute("data-state", "ready");
            text.data = "changed";

            if (kind === "wrapping") {
                anchor.append(document.createElement("strong"));
            }

            await jest.advanceTimersByTimeAsync(201);
            expect(update).toHaveBeenCalledTimes(kind === "owned" ? 0 : 1);

            unwatch();
            context.unmount();
            expect(context.owns(container)).toBe(false);

            if (kind === "owned") {
                context.mount();
                expect(node.container).not.toBe(container);
                expect(context.owns(node.container!)).toBe(true);
            }
        } finally {
            unwatch();
            context.clear();
        }
    });

    test("filters owned UI through a wrapped public context", async () => {
        jest.useFakeTimers();
        const anchor = document.createElement("article");
        const container = document.createElement("section");
        document.body.append(anchor);
        const managedContext = new ManagedContext(new EventEmitter());
        const node = new MountNode(new Node(anchor, container), managedContext.containers, (anchor, container) =>
            anchor.append(container)
        );
        managedContext.add(node);
        managedContext.mount();

        const context: ContentScriptContext = {
            get nodes() {
                return managedContext.nodes;
            },
            owns: target => managedContext.owns(target),
            mount: () => managedContext.mount(),
            unmount: () => managedContext.unmount(),
            watch: callback => managedContext.watch(callback),
            unwatch: () => managedContext.unwatch(),
        };

        const update = jest.fn();
        const unwatch = createMutationObserverStrategy()(update, context);

        try {
            container.append(document.createElement("span"));
            await jest.advanceTimersByTimeAsync(201);
            expect(update).not.toHaveBeenCalled();
            document.body.append(document.createElement("article"));
            await jest.advanceTimersByTimeAsync(201);
            expect(update).toHaveBeenCalledTimes(1);
        } finally {
            unwatch();
            managedContext.clear();
        }
    });

    test.each(["remove", "move", "mixed"])("observes %s mutations outside an owned container", async kind => {
        jest.useFakeTimers();
        const anchor = document.createElement("article");
        const destination = document.createElement("aside");
        document.body.append(anchor, destination);
        const container = document.createElement("section");
        const context = new ManagedContext(new EventEmitter());
        const node = new MountNode(new Node(anchor, container), context.containers, (anchor, container) =>
            anchor.append(container)
        );
        context.add(node);
        context.mount();
        const update = jest.fn();
        const unwatch = createMutationObserverStrategy()(update, context);

        try {
            container.append(document.createElement("span"));

            if (kind === "remove") {
                container.remove();
            } else if (kind === "move") {
                destination.append(container);
            } else {
                destination.append(document.createElement("span"));
            }

            await jest.advanceTimersByTimeAsync(201);
            expect(update).toHaveBeenCalledTimes(1);
        } finally {
            unwatch();
            context.clear();
        }
    });

    test("await-first stops observing once an update adds content nodes", async () => {
        jest.useFakeTimers();
        const context = new ManagedContext(new EventEmitter());

        const update = jest.fn(async () => {
            await Promise.resolve();
            context.add(new Node(document.body));
        });

        const unwatch = createAwaitFirstStrategy()(update, context);

        try {
            document.body.append(document.createElement("article"));
            await Promise.resolve();
            await jest.advanceTimersByTimeAsync(201);
            expect(update).toHaveBeenCalledTimes(1);
            expect(context.nodes.size).toBe(1);

            document.body.append(document.createElement("article"));
            await Promise.resolve();
            jest.advanceTimersByTime(201);
            expect(update).toHaveBeenCalledTimes(1);
        } finally {
            unwatch();
            context.clear();
        }
    });

    test("await-first keeps requesting updates during one pending cycle and stops after its completion", async () => {
        jest.useFakeTimers();
        const context = new ManagedContext(new EventEmitter());
        const cycle = Promise.withResolvers<void>();
        const completion = cycle.promise.then(() => {
            context.add(new Node(document.body));
        });
        const update = jest.fn(() => completion);
        const unwatch = createAwaitFirstStrategy()(update, context);

        try {
            for (let index = 0; index < 5; index++) {
                document.body.append(document.createElement("span"));
                await jest.advanceTimersByTimeAsync(201);
            }

            expect(update).toHaveBeenCalledTimes(5);
            expect(context.nodes.size).toBe(0);
            cycle.resolve();
            await jest.advanceTimersByTimeAsync(0);
            document.body.append(document.createElement("article"));
            await jest.advanceTimersByTimeAsync(201);
            expect(update).toHaveBeenCalledTimes(5);
            expect(context.nodes.size).toBe(1);
        } finally {
            cycle.resolve();
            await completion;
            unwatch();
            context.clear();
        }
    });
});
