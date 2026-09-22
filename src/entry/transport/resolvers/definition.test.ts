import {mergeDefinition} from "./definition";

describe("Transport definitions", () => {
    test("merges default options over named exports and uses the build name without executing callbacks", () => {
        const init = jest.fn(() => ({ready: true}));
        const main = jest.fn();
        const defaults = Object.freeze({name: "default-name", init, excludeBrowser: ["firefox"]});
        const module = Object.freeze({
            default: defaults,
            name: "named-name",
            main,
            excludeBrowser: ["edge"],
            persistent: true,
        });

        expect(mergeDefinition(module, "build-name")).toEqual({
            name: "build-name",
            init,
            main,
            excludeBrowser: defaults.excludeBrowser,
            persistent: true,
        });
        expect(module.name).toBe("named-name");
        expect(module.excludeBrowser).toEqual(["edge"]);
        expect(defaults.name).toBe("default-name");
        expect(init).not.toHaveBeenCalled();
        expect(main).not.toHaveBeenCalled();
    });

    test("treats a default function as init over a named init", () => {
        const namedInit = jest.fn(() => ({named: true}));
        const init = jest.fn(() => ({ready: true}));
        const main = jest.fn();

        expect(mergeDefinition({default: init, init: namedInit, main}, "worker")).toEqual({
            name: "worker",
            init,
            main,
        });
        expect(namedInit).not.toHaveBeenCalled();
        expect(init).not.toHaveBeenCalled();
    });

    test.each([undefined, null, false, true, "", "ignored", 0, []])(
        "preserves named exports when default is not a definition or init: %p",
        value => {
            const init = jest.fn(() => ({ready: true}));

            expect(mergeDefinition({default: value, init, name: "ignored", persistent: false}, "worker")).toEqual({
                name: "worker",
                init,
                main: undefined,
                persistent: false,
            });
        }
    );
});
