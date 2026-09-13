import path from "path";

import ContentParser from "./ContentParser";

import type {ReadonlyConfig} from "@typing/config";
import {ContentScriptShadowMode, ContentScriptWorld} from "@typing/content";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures", "content");

const parser = new ContentParser({rootDir} as ReadonlyConfig);

const file = (...parts: string[]) => {
    const filename = path.join(fixtures, ...parts);

    return {file: filename, import: filename};
};

describe("ContentParser", () => {
    test.each([
        ["enum", {mode: ContentScriptShadowMode.Closed}],
        ["open", {mode: ContentScriptShadowMode.Open}],
        ["string", {mode: "closed"}],
        ["constant", {mode: "closed"}],
        ["imported", {mode: "closed"}],
        ["empty", {mode: "open"}],
        ["spread", {mode: "closed"}],
    ])("parses Shadow options from %s", (name, shadow) => {
        expect(parser.options(file("options", "shadow", name + ".content.ts"))).toMatchObject({
            isolation: {type: "shadow", ...shadow},
        });
    });
    test.each([
        ["iframe", /isolation.mode is not supported/],
        ["frame", /isolation.height is not supported/],
        ["mode", /isolation.mode must be "open" or "closed"/],
        ["dynamic", /isolation.mode must be statically known/],
        ["identifier", /isolation.mode must be statically known/],
        ["unknown", /isolation.delegatesFocus is not supported/],
    ])("rejects invalid Shadow options from %s", (name, error) => {
        const target = file("invalid", "shadow", name + ".content.ts");
        expect(() => parser.options(target)).toThrow(error);
        expect(() => parser.options(target)).toThrow(target.file);
    });
    test.each([
        "named-function.content.tsx",
        "anonymous-function.content.tsx",
        "arrow.content.tsx",
        "local-component.content.tsx",
        "imported-component.content.tsx",
        "reexported-component.content.tsx",
        "jsx.content.tsx",
        "Panel.content.tsx",
        "element-object.content.ts",
    ])("rejects frame navigation with default render: %s", name => {
        const target = file("invalid", "default-render", name);
        expect(() => parser.options(target)).toThrow(/isolation.page\/isolation.src cannot be combined with render/);
        expect(() => parser.options(target)).toThrow(target.file);
    });
    test.each([
        "function.content.tsx",
        "object.content.ts",
        "local-object.content.ts",
        "imported-object.content.ts",
        "named-marker.content.ts",
    ])("preserves a valid default export in %s", name => {
        const options = parser.options(file("options", "default-render", name));
        expect(options.isolation?.type).toBe(name === "function.content.tsx" ? "shadow" : "iframe");
        expect(options).not.toHaveProperty("render");
    });
    test("resolves a local frame object without treating identifiers as aliases", () => {
        expect(parser.options(file("options", "isolation", "frame-constant.content.ts"))).toMatchObject({
            isolation: {type: "iframe", page: "panel", height: 320},
        });
    });
    test("parses the isolation enum and frame dimensions", () => {
        expect(parser.options(file("options", "isolation", "iframe.content.ts"))).toMatchObject({
            isolation: {type: "iframe", height: 320},
        });
    });
    test("projects the Shadow isolation mode without runtime properties", () => {
        expect(parser.options(file("options", "isolation", "shadow.content.ts"))).toEqual({
            matches: ["http://*/*", "https://*/*"],
            runAt: "document_idle",
            isolation: {type: "shadow", mode: "open"},
        });
    });
    test("resolves a local page alias", () => {
        expect(parser.options(file("options", "isolation", "page.content.ts"))).toMatchObject({
            isolation: {type: "iframe", page: "panel", width: "80%"},
        });
    });
    test("preserves frame source and numeric/CSS dimensions in the normalized options", () => {
        expect(parser.options(file("options", "isolation", "source.content.ts"))).toEqual({
            matches: ["http://*/*", "https://*/*"],
            runAt: "document_idle",
            isolation: {
                type: "iframe",
                src: "https://example.com/panel",
                width: 0,
                height: "calc(100vh - 24px)",
            },
        });
    });
    test.each([
        ["iframe-short", {type: "iframe", width: "100%", height: 150}],
        ["none-object", {type: "none"}],
    ])("normalizes shorthand and explicit options from %s", (name, isolation) => {
        expect(parser.options(file("options", "isolation", name + ".content.ts"))).toMatchObject({isolation});
    });
    test.each([
        ["isolation-missing-type", /isolation.type must be/],
        ["isolation-type-dynamic", /isolation.type must be statically known/],
        ["isolation-type-identifier", /isolation.type must be statically known/],
        ["isolation-none-options", /isolation.mode is not supported/],
        ["frame-identifier-page", /statically known/],
        ["frame-conflict", /mutually exclusive/],
        ["frame-render", /cannot be combined/],
        ["frame-auto", /not supported yet/],
        ["frame-spread", /statically known/],
        ["isolation-dynamic", /statically known/],
        ["frame-dynamic-page", /statically known/],
        ["frame-dynamic-src", /statically known/],
    ])("rejects %s with an actionable diagnostic", (name, error) => {
        expect(() => parser.options(file("invalid", name + ".content.ts"))).toThrow(error);
    });
    test.each([
        ["enum.content.ts", ContentScriptWorld.Main],
        ["string.content.ts", ContentScriptWorld.Isolated],
    ])("parses the execution world from %s", (name, world) => {
        expect(parser.options(file("options", "world", name))).toEqual({
            matches: ["http://*/*", "https://*/*"],
            runAt: "document_idle",
            world,
            isolation: {type: "none"},
        });
    });
});
