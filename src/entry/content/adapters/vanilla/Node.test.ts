import VanillaNode from "./Node";

import type {ContentScriptNode} from "@typing/content";

describe("VanillaNode", () => {
    test("renders into the target while preserving the outer host", () => {
        const anchor = document.createElement("div");
        const container = document.createElement("section");
        const target = document.createElement("div");
        const value = document.createElement("span");
        const node: ContentScriptNode = {
            anchor,
            container,
            target,
            mount: jest.fn(() => true),
            unmount: jest.fn(() => true),
        };
        const vanillaNode = new VanillaNode(node, value);

        expect(vanillaNode.mount()).toBe(true);
        expect(node.mount).toHaveBeenCalledTimes(1);
        expect(target.contains(value)).toBe(true);
        expect(container.contains(value)).toBe(false);

        expect(vanillaNode.unmount()).toBe(true);
        expect(node.unmount).toHaveBeenCalledTimes(1);
    });
});
