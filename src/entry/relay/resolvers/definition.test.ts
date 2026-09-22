import {resolveDefinition} from "./definition";

describe("Relay definitions", () => {
    test("treats a default function as init while preserving named render and main", () => {
        const namedInit = jest.fn(() => ({named: true}));
        const init = jest.fn(() => ({ready: true}));
        const main = jest.fn();
        const render = jest.fn(() => "content");

        expect(resolveDefinition({default: init, init: namedInit, main, render}, "panel")).toEqual({
            name: "panel",
            init,
            main,
            render,
        });
        expect(namedInit).not.toHaveBeenCalled();
        expect(init).not.toHaveBeenCalled();
        expect(render).not.toHaveBeenCalled();
        expect(main).not.toHaveBeenCalled();
    });

    test("does not infer render from a default init function", () => {
        const init = jest.fn(() => ({ready: true}));
        const definition = resolveDefinition({default: init, isolation: {type: "iframe", page: "panel"}}, "panel");

        expect(definition).toEqual({name: "panel", init, main: undefined, isolation: {type: "iframe", page: "panel"}});
        expect(definition).not.toHaveProperty("render");
        expect(init).not.toHaveBeenCalled();
    });
});
