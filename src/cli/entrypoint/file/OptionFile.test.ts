import "./tests/background";

import path from "path";
import OptionFile from "./OptionFile";

const fixtures = path.resolve(__dirname, "tests/fixtures/static-options");
const read = (name: string, properties: string[]) =>
    OptionFile.make(path.join(fixtures, name + ".ts"))
        .setDefinition("defineContentScript")
        .setProperties(properties);

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
