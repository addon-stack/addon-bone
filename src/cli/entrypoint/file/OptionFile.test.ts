import path from "path";
import OptionFile from "./OptionFile";

const fixtures = path.resolve(__dirname, "tests/fixtures/static-options");
const read = (name: string, properties: string[]) =>
    OptionFile.make(path.join(fixtures, name + ".ts"))
        .setDefinition("defineContentScript")
        .setProperties(properties);

const shapes = path.resolve(__dirname, "tests/fixtures/export-shapes");
const shape = (name: string, properties: string[], definition: string | string[] = "defineBackground") =>
    OptionFile.make(path.join(shapes, name + ".ts"))
        .setDefinition(definition)
        .setProperties(properties);

/**
 * How an entrypoint file may declare its options. The reader does not know entrypoints: parsers only
 * supply a definition name and schema keys, so every shape is covered here once, not per entrypoint.
 * The definition used by a fixture is arbitrary; each parser proves its own one in its `full` scenario.
 */
describe("OptionFile export shapes", () => {
    test.each([
        {
            title: "a definition call",
            name: "definition-only",
            properties: ["persistent", "includeBrowser"],
            expected: {persistent: true, includeBrowser: ["firefox"]},
        },
        {
            title: "a generic definition call with explicit type arguments",
            name: "definition-type-arguments",
            definition: "defineService",
            properties: ["name", "includeBrowser"],
            expected: {name: "math", includeBrowser: ["firefox"]},
        },
        {
            title: "a definition call behind satisfies",
            name: "definition-satisfies",
            definition: "definePopup",
            properties: ["title", "excludeBrowser"],
            expected: {title: "Popup", excludeBrowser: ["safari"]},
        },
        {
            title: "a definition call with shorthand and imported values",
            name: "definition-shorthand",
            properties: ["permissions", "persistent", "excludeBrowser", "includeBrowser", "excludeApp"],
            expected: {
                permissions: ["storage", "tabs"],
                persistent: true,
                excludeBrowser: ["edge"],
                includeBrowser: ["firefox"],
                excludeApp: ["my_test_app"],
            },
        },
        {
            title: "named exports beside a default function",
            name: "default-function",
            properties: ["persistent", "excludeBrowser", "excludeApps"],
            expected: {persistent: true, excludeBrowser: ["edge"], excludeApps: ["my_test_app"]},
        },
        {
            title: "named exports combined with a definition call",
            name: "definition-with-named-exports",
            properties: ["persistent", "excludeBrowser", "includeBrowser"],
            expected: {persistent: true, excludeBrowser: ["edge"], includeBrowser: ["firefox"]},
        },
        {
            title: "named exports combined with a default object",
            name: "default-object",
            properties: ["persistent", "excludeBrowser", "includeBrowser"],
            expected: {persistent: true, excludeBrowser: ["opera"], includeBrowser: ["chrome"]},
        },
        {
            title: "a default object behind a type assertion",
            name: "default-object-assertion",
            properties: ["persistent", "excludeBrowser", "includeBrowser"],
            expected: {persistent: true, excludeBrowser: ["safari"], includeBrowser: ["chromium"]},
        },
        {
            title: "a default object behind satisfies",
            name: "default-object-satisfies",
            properties: ["persistent", "excludeBrowser", "includeBrowser"],
            expected: {persistent: true, includeBrowser: ["chromium"]},
        },
    ])("reads $title", ({name, definition, properties, expected}) => {
        expect(shape(name, properties, definition).getOptions()).toEqual(expected);
    });

    test("prefers the default export over named exports and keeps an explicit false", () => {
        expect(shape("default-over-named", ["persistent", "includeBrowser", "excludeBrowser"]).getOptions()).toEqual({
            persistent: false,
            includeBrowser: ["firefox"],
            excludeBrowser: ["opera"],
        });
    });

    test("reads only the properties requested by the caller", () => {
        expect(shape("definition-with-named-exports", ["includeBrowser"]).getOptions()).toEqual({
            includeBrowser: ["firefox"],
        });
    });

    test("ignores options wrapped in a definition the caller did not allow", () => {
        const file = shape("foreign-definition", ["persistent", "includeBrowser", "excludeBrowser"]);

        expect(file.getOptions()).toEqual({excludeBrowser: ["edge"]});
        expect(file.getDefinition()).toBeUndefined();
    });

    test("ignores a definition that is not imported from the framework and warns about it", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

        try {
            const file = shape("local-definition", ["persistent", "includeBrowser", "excludeBrowser"]);

            expect(file.getOptions()).toEqual({excludeBrowser: ["edge"]});
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("Function defineBackground is not imported"));
        } finally {
            warn.mockRestore();
        }
    });

    test("reports which of the allowed definitions wraps the options", () => {
        const definitions = ["defineCommand", "defineExecuteActionCommand"];

        expect(shape("alternative-definition", ["defaultKey"], definitions).getDefinition()).toBe(
            "defineExecuteActionCommand"
        );
        expect(shape("definition-only", ["persistent"], definitions).getDefinition()).toBeUndefined();
    });
});

describe("OptionFile static values", () => {
    test("reads nested objects, enum injectors, imported constants and ordered spreads", () => {
        expect(read("definition", ["isolation", "includeBrowser"]).getOptions()).toEqual({
            isolation: {type: "shadow", mode: "closed"},
            includeBrowser: ["firefox", "chrome"],
        });
    });

    test("selects build properties before reading runtime expressions, including spread properties", () => {
        const file = read("definition", ["isolation"]);
        expect(file.getDeclaredProperties()).toEqual(new Set(["isolation", "includeBrowser", "render", "main"]));
        expect(file.getOptions()).toEqual({isolation: {type: "shadow", mode: "closed"}});
    });

    test("reads imported objects and literal computed keys without losing false, zero or undefined", () => {
        expect(read("values", ["settings"]).getOptions()).toEqual({
            settings: {enabled: false, count: 0, label: "", empty: null, missing: undefined, sizes: [-1, 0, 320]},
        });
    });

    test("resolves local and imported enum members and framework import aliases", () => {
        expect(read("values", ["enums"]).getOptions()).toEqual({
            enums: {first: 0, next: 1, named: "closed", world: "ISOLATED", mode: "closed"},
        });
    });

    test("follows named re-exports without evaluating other exports", () => {
        expect(read("re-export", ["mode", "count"]).getOptions()).toEqual({mode: "closed", count: 1});
    });

    test("does not reinterpret literal strings as local identifiers", () => {
        expect(read("values", ["literal"]).getOptions()).toEqual({literal: "shadow"});
    });

    test("reads a selected object member without evaluating its runtime siblings", () => {
        expect(read("values", ["selected"]).getOptions()).toEqual({selected: 320});
    });

    test("reads a static object passed to the definition helper through TypeScript wrappers", () => {
        const file = read("wrapped", ["isolation"]);
        expect(file.getOptions()).toEqual({isolation: {type: "shadow", mode: "closed"}});
        expect(file.getDefinition()).toBe("defineContentScript");
    });

    test("rejects a dynamic definition argument instead of silently ignoring it", () => {
        expect(() => read("dynamic-definition", ["isolation"]).getOptions()).toThrow(
            /options must be statically known/
        );
    });

    test("detects cycles across imported files", () => {
        expect(() => read("cycle-a", ["options"]).getOptions()).toThrow(
            /options must be statically known: circular reference/
        );
    });

    test("uses the last property declaration without evaluating overwritten expressions", () => {
        expect(read("overrides", ["isolation"]).getOptions()).toEqual({isolation: {type: "shadow", mode: "closed"}});
    });

    test.each([
        ["unresolved", "unresolved.type"],
        ["dynamic", "dynamic.page"],
        ["spread", "spread"],
        ["computed", "computed"],
        ["method", "method.value"],
        ["cycle", "cycle"],
        ["asset", "asset"],
        ["unknownEnum", "unknownEnum"],
        ["mutable", "mutable"],
        ["destructured", "destructured"],
    ])("rejects %s instead of producing partial options", (property, field) => {
        const file = read("invalid", [property]);
        expect(() => file.getOptions()).toThrow(field + " must be statically known");
        expect(() => file.getOptions()).toThrow(path.join(fixtures, "invalid.ts"));
    });
});
