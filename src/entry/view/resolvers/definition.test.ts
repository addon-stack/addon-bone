import {mergeDefinition} from "./definition";

describe("View definitions", () => {
    const isRenderInput = (value: unknown): boolean => typeof value === "function";

    test("merges default options over named exports without mutating either object", () => {
        const render = jest.fn();
        const defaults = Object.freeze({title: "Default", render});
        const module = Object.freeze({default: defaults, title: "Named", template: "page.html"});

        expect(mergeDefinition(module, isRenderInput)).toEqual({title: "Default", render, template: "page.html"});
        expect(module.title).toBe("Named");
        expect(render).not.toHaveBeenCalled();
    });

    test("uses a recognized default render over a named render", () => {
        const render = jest.fn();
        const namedRender = jest.fn();

        expect(mergeDefinition({default: render, render: namedRender, title: "Named"}, isRenderInput)).toEqual({
            title: "Named",
            render,
        });
        expect(render).not.toHaveBeenCalled();
    });

    test.each([undefined, null, false, true, "", 0, []])("preserves named options with a default %p", value => {
        const render = jest.fn();

        expect(mergeDefinition({default: value, render, title: "Named"}, isRenderInput)).toEqual({
            render,
            title: "Named",
        });
    });
});
