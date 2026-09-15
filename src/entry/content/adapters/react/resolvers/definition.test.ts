import {resolveDefinition} from "./definition";

describe("React content definitions", () => {
    test("merges default options over named exports without mutating either object", () => {
        const main = jest.fn();
        const defaults = Object.freeze({matches: ["https://default.example/*"], main});
        const module = Object.freeze({default: defaults, matches: ["https://named.example/*"], anchor: "article"});

        expect(resolveDefinition(module)).toEqual({matches: defaults.matches, main, anchor: "article"});
        expect(module.matches).toEqual(["https://named.example/*"]);
        expect(main).not.toHaveBeenCalled();
    });

    test.each([undefined, null, false, true, ""])("preserves named options with an empty default %p", value => {
        const main = jest.fn();
        expect(resolveDefinition({default: value, main})).toEqual({main});
    });

    test("a property named $$typeof alone does not identify a React element", () => {
        const definition = {main: jest.fn(), $$typeof: "application metadata"};
        expect(resolveDefinition({default: definition})).toEqual(definition);
    });
});
