import {ManagedContext, EventEmitter} from "./index";
import {MountNode, Node} from "../nodes";
import {ContentScriptEvent} from "@typing/content";

afterEach(() => {
    document.body.replaceChildren();
});

const addPanel = (context: ManagedContext, cleanup?: () => void) => {
    const anchor = document.createElement("article");
    const container = document.createElement("section");
    document.body.append(anchor);

    const node = new MountNode(new Node(anchor, container), context.containers, (anchor, container) => {
        anchor.append(container);

        return cleanup;
    });
    context.add(node);
    context.mount();

    return {node, container};
};

test("clears every node and registration and emits removal", () => {
    const context = new ManagedContext(new EventEmitter());
    const {node, container} = addPanel(context);
    const events = jest.fn();
    context.watch(events);
    expect(context.owns(container)).toBe(true);
    expect(new ManagedContext(new EventEmitter()).owns(container)).toBe(false);

    context.clear();

    expect(events).toHaveBeenCalledWith(ContentScriptEvent.Remove, node);
    expect(context.nodes.size).toBe(0);
    expect(context.owns(container)).toBe(false);
    expect(container.isConnected).toBe(false);
});

test("clear releases all registrations even when one node cleanup throws", () => {
    const context = new ManagedContext(new EventEmitter());
    const first = addPanel(context, () => {
        throw new Error("Cleanup failed");
    });
    const second = addPanel(context);
    const events = jest.fn();
    context.watch(events);

    expect(() => context.clear()).toThrow("Content script context cleanup failed");

    for (const {node, container} of [first, second]) {
        expect(container.isConnected).toBe(false);
        expect(context.owns(container)).toBe(false);
        expect(events).toHaveBeenCalledWith(ContentScriptEvent.Remove, node);
    }

    expect(context.nodes.size).toBe(0);
    const next = addPanel(context);
    expect(context.owns(next.container)).toBe(true);
    context.clear();
});
