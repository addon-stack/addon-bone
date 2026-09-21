import {createElement} from "react";

import {resolveDefinition} from "./definition";

describe("Vanilla view definitions", () => {
    test.each([
        ["a render function", () => "rendered"],
        ["a non-empty string", "<p>Hello</p>"],
        ["a number", 42],
        ["an element", document.createElement("p")],
    ])("uses %s as the default render", (_, value) => {
        expect(resolveDefinition({default: value, title: "Named"})).toEqual({title: "Named", render: value});
    });

    test("does not recognize React elements, so a plain element object is options", () => {
        const element = createElement("p");

        expect(resolveDefinition({default: element})).not.toHaveProperty("render");
    });

    test("merges a default options object over named exports", () => {
        const render = jest.fn();

        expect(resolveDefinition({default: {title: "Default", render}, title: "Named"})).toEqual({
            title: "Default",
            render,
        });
        expect(render).not.toHaveBeenCalled();
    });
});
