import {createAwaitFirstStrategy, createMutationObserverStrategy} from "../../../content";
import {EventEmitter, ManagedContext} from "../lifecycle/context";
import Node from "../lifecycle/nodes/Node";

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
            const unwatch = createMutationObserverStrategy()(jest.fn(), {} as never);

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

    test("await-first stops observing once an update adds content nodes", async () => {
        jest.useFakeTimers();
        const context = new ManagedContext(new EventEmitter());
        const update = jest.fn(() => context.add(new Node(document.body)));
        const unwatch = createAwaitFirstStrategy()(update, context);

        try {
            document.body.append(document.createElement("article"));
            await Promise.resolve();
            jest.advanceTimersByTime(201);
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
});
