import {resolveDefinition} from "./definition";

describe("Relay definitions", () => {
    test("merges default options over named exports and uses the build name without executing callbacks", () => {
        const init = jest.fn(() => ({ready: true}));
        const main = jest.fn();
        const defaults = Object.freeze({name: "default-name", init, matches: ["https://default.example/*"]});
        const module = Object.freeze({
            default: defaults,
            name: "named-name",
            main,
            matches: ["https://named.example/*"],
            anchor: "article",
        });

        expect(resolveDefinition(module, "build-name")).toEqual({
            name: "build-name",
            init,
            main,
            matches: defaults.matches,
            anchor: "article",
        });
        expect(module.name).toBe("named-name");
        expect(module.matches).toEqual(["https://named.example/*"]);
        expect(defaults.name).toBe("default-name");
        expect(init).not.toHaveBeenCalled();
        expect(main).not.toHaveBeenCalled();
    });

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

    test.each([undefined, null, false, true, "", "ignored", 0, []])(
        "preserves named exports when default is not a definition or init: %p",
        value => {
            const init = jest.fn(() => ({ready: true}));
            expect(resolveDefinition({default: value, init, name: "ignored", allFrames: false}, "panel")).toEqual({
                name: "panel",
                init,
                main: undefined,
                allFrames: false,
            });
        }
    );
});
