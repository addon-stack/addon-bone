import {resolveDefinition} from "./definition";

describe("Vanilla content definitions", () => {
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
});
