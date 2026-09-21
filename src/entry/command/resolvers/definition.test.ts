import {resolveDefinition} from "./definition";

describe("Command definitions", () => {
    test("merges default options over named exports and uses the build name without executing", () => {
        const execute = jest.fn();
        const namedExecute = jest.fn();
        const defaults = Object.freeze({name: "default-name", execute, defaultKey: "Ctrl+Shift+D"});
        const module = Object.freeze({
            default: defaults,
            name: "named-name",
            execute: namedExecute,
            defaultKey: "Ctrl+Shift+N",
            description: "Named",
        });

        expect(resolveDefinition(module, "build-name")).toEqual({
            name: "build-name",
            execute,
            defaultKey: "Ctrl+Shift+D",
            description: "Named",
        });
        expect(module.name).toBe("named-name");
        expect(defaults.name).toBe("default-name");
        expect(execute).not.toHaveBeenCalled();
        expect(namedExecute).not.toHaveBeenCalled();
    });

    test("treats a default function as execute over a named execute", () => {
        const execute = jest.fn();
        const namedExecute = jest.fn();

        expect(
            resolveDefinition({default: execute, execute: namedExecute, defaultKey: "Ctrl+Shift+P"}, "ping")
        ).toEqual({
            name: "ping",
            execute,
            defaultKey: "Ctrl+Shift+P",
        });
        expect(execute).not.toHaveBeenCalled();
        expect(namedExecute).not.toHaveBeenCalled();
    });

    test.each([undefined, null, false, true, "", "ignored", 0, []])(
        "preserves named exports when default is not a definition or execute: %p",
        value => {
            const execute = jest.fn();

            expect(resolveDefinition({default: value, execute, name: "ignored", global: false}, "ping")).toEqual({
                name: "ping",
                execute,
                global: false,
            });
        }
    );
});
