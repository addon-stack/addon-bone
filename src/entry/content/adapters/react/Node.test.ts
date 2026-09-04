import {createRoot} from "react-dom/client";

import ReactNode from "./Node";

import type {ContentScriptNode} from "@typing/content";

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

    test("renders into the target while preserving the outer host", () => {
        const anchor = document.createElement("div");
        const container = document.createElement("section");
        const target = document.createElement("div");
        const node: ContentScriptNode = {
            anchor,
            container,
            target,
            mount: jest.fn(() => true),
            unmount: jest.fn(() => true),
        };
        const component = "content";
        const reactNode = new ReactNode(node, component);

        expect(reactNode.mount()).toBe(true);
        expect(node.mount).toHaveBeenCalledTimes(1);
        expect(createRoot).toHaveBeenCalledWith(target);
        expect(createRoot).not.toHaveBeenCalledWith(container);
        expect(render).toHaveBeenCalledWith(component);

        expect(reactNode.unmount()).toBe(true);
        expect(unmount).toHaveBeenCalledTimes(1);
        expect(node.unmount).toHaveBeenCalledTimes(1);
    });
});
