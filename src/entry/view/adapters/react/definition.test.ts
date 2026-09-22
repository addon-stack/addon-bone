import {createElement} from "react";
import {createPortal} from "react-dom";

import {resolveDefinition} from "./definition";

describe("React view definitions", () => {
    test("uses a default React element as the render", () => {
        const element = createElement("p", null, "Hello");

        expect(resolveDefinition({default: element, title: "Named"})).toEqual({title: "Named", render: element});
    });

    test("uses a default component function as the render without calling it", () => {
        const Component = jest.fn(() => null);

        expect(resolveDefinition({default: Component})).toEqual({render: Component});
        expect(Component).not.toHaveBeenCalled();
    });

    test("merges a default options object over named exports", () => {
        const render = jest.fn();

        expect(resolveDefinition({default: {title: "Default", render}, title: "Named"})).toEqual({
            title: "Default",
            render,
        });
    });

    test.each([
        ["an array of nodes", [createElement("p", {key: "p"}), "text"]],
        ["a portal", createPortal(createElement("p"), document.createElement("div"))],
        ["a bigint", 42n],
    ])("uses %s as the default render", (_, value) => {
        expect(resolveDefinition({default: value, title: "Named"})).toEqual({title: "Named", render: value});
    });

    test("a property named $$typeof alone does not identify a React element", () => {
        const definition = {title: "Options", $$typeof: "application metadata"};

        expect(resolveDefinition({default: definition})).toEqual(definition);
    });
});
