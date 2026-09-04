import Context from "./Context";

import type {ContentScriptEventEmitter, ContentScriptNode} from "@typing/content";

describe("Context", () => {
    test("clears every node after unmounting it and emits removal", () => {
        const remove = jest.fn();
        const emitter = {
            emitRemove: remove,
        } as unknown as ContentScriptEventEmitter;
        const context = new (class extends Context {
            public add(node: ContentScriptNode): void {
                this.collection.add(node);
            }
        })(emitter);
        const node = {
            anchor: document.createElement("div"),
            mount: jest.fn(),
            unmount: jest.fn(() => true),
        } satisfies ContentScriptNode;
        context.add(node);

        context.clear();

        expect(node.unmount).toHaveBeenCalledTimes(1);
        expect(remove).toHaveBeenCalledWith(node);
        expect(context.nodes.size).toBe(0);
    });
});
