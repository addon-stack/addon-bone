import {createElement} from "react";
import {createRoot} from "react-dom/client";

import ReactNode from "./Node";

import {ContentScriptShadowMode} from "@typing/content";

const render = jest.fn();
const unmount = jest.fn();

jest.mock("react-dom/client", () => ({
    createRoot: jest.fn(),
}));

describe("ReactNode", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(createRoot).mockReturnValue({render, unmount} as never);
    });

    test("a failed React unmount releases the inner node and does not retain the root", () => {
        const anchor = document.createElement("article");
        const target = document.createElement("section");
        document.body.append(anchor);
        const node = {anchor, target, mount: jest.fn(), unmount: jest.fn()};
        const renderer = new ReactNode(
            node,
            () => createElement("span"),
            () => ({
                anchor,
                container: target,
                target,
                boundary: undefined,
                data: undefined,
            })
        );

        try {
            renderer.mount();
            unmount.mockImplementationOnce(() => {
                throw new Error("React cleanup failed");
            });

            expect(() => renderer.unmount()).toThrow("React cleanup failed");
            expect(node.unmount).toHaveBeenCalledTimes(1);
            renderer.unmount();
            expect(unmount).toHaveBeenCalledTimes(1);
        } finally {
            anchor.remove();
        }
    });

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

            const node = {
                anchor,
                container,
                target,
                mount: jest.fn(() => true),
                unmount: jest.fn(() => true),
            };

            const component = createElement("span", null, "content");

            const reactNode = new ReactNode(
                node,
                () => component,
                () => ({anchor, container, target, data: undefined, boundary: undefined})
            );

            expect(reactNode.mount()).toBe(true);
            expect(node.mount).toHaveBeenCalledTimes(1);
            expect(createRoot).toHaveBeenCalledWith(target);
            expect(createRoot).not.toHaveBeenCalledWith(container);
            expect(render).toHaveBeenCalledWith(component);

            expect(reactNode.unmount()).toBe(true);
            expect(unmount).toHaveBeenCalledTimes(1);
            expect(node.unmount).toHaveBeenCalledTimes(1);
            anchor.remove();
        }
    );
});
