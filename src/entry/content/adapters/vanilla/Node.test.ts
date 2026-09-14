import VanillaNode from "./Node";

import {ContentScriptShadowMode} from "@typing/content";

describe("VanillaNode", () => {
    test.each([undefined, ContentScriptShadowMode.Open, ContentScriptShadowMode.Closed])(
        "renders into the target while preserving the outer host in %s mode",
        mode => {
            const anchor = document.createElement("div");
            document.body.append(anchor);
            const container = document.createElement("section");
            const target = document.createElement("div");

            if (mode) {
                container.attachShadow({mode}).appendChild(target);
            }

            const value = document.createElement("span");

            const node = {
                anchor,
                container,
                target,
                mount: jest.fn(() => true),
                unmount: jest.fn(() => true),
            };

            const vanillaNode = new VanillaNode(
                node,
                () => value,
                () => ({anchor, container, target, data: undefined})
            );

            expect(vanillaNode.mount()).toBe(true);
            expect(node.mount).toHaveBeenCalledTimes(1);
            expect(target.contains(value)).toBe(true);
            expect(container.contains(value)).toBe(false);

            expect(vanillaNode.unmount()).toBe(true);
            expect(node.unmount).toHaveBeenCalledTimes(1);
            anchor.remove();
        }
    );
});
