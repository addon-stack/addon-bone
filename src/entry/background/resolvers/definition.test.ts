import {resolveDefinition} from "./definition";

describe("Background definitions", () => {
    test("merges default options over named exports without executing main", () => {
        const main = jest.fn();
        const namedMain = jest.fn();
        const defaults = Object.freeze({main, persistent: true});
        const module = Object.freeze({
            default: defaults,
            main: namedMain,
            persistent: false,
            excludeBrowser: ["edge"],
        });

        expect(resolveDefinition(module)).toEqual({main, persistent: true, excludeBrowser: ["edge"]});
        expect(module.persistent).toBe(false);
        expect(main).not.toHaveBeenCalled();
        expect(namedMain).not.toHaveBeenCalled();
    });

    test("treats a default function as main over a named main", () => {
        const main = jest.fn();
        const namedMain = jest.fn();

        expect(resolveDefinition({default: main, main: namedMain, persistent: true})).toEqual({
            main,
            persistent: true,
        });
        expect(main).not.toHaveBeenCalled();
        expect(namedMain).not.toHaveBeenCalled();
    });

    test.each([undefined, null, false, true, "", "ignored", 0, []])(
        "preserves named exports when default is not a definition or main: %p",
        value => {
            const main = jest.fn();

            expect(resolveDefinition({default: value, main, persistent: false})).toEqual({main, persistent: false});
        }
    );
});
