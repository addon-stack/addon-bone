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
                () => ({anchor, container, target, data: undefined})
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
