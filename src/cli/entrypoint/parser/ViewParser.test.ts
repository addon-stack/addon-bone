import path from "path";

import ViewParser from "./ViewParser";

import type {ReadonlyConfig} from "@typing/config";
import type {ViewEntrypointOptions} from "@typing/view";

class TestViewParser extends ViewParser<ViewEntrypointOptions> {
    protected definition(): string {
        return "definePage";
    }
}

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.join(__dirname, "tests", "fixtures", "view");
const parser = new TestViewParser({rootDir} as ReadonlyConfig);
const parseOptions = (...parts: string[]) => {
    const file = path.join(fixtures, ...parts);

    return parser.options({file, import: file});
};

describe("ViewParser", () => {
    test("reads the view options, HTML flags and static tag fields from a real entrypoint", () => {
        expect(parseOptions("options", "full", "page.ts")).toEqual({
            as: "panel",
            title: "HTML options",
            template: "./template.html",
            append: false,
            useHash: true,
            usePublicPath: false,
            prependExternals: false,
            jsExtensions: [".js", ".module"],
            cssExtensions: ".css",
            links: ["theme.css", {path: "icon.ico", sourcePath: "icon.ico", attributes: {rel: "icon"}}],
            scripts: ["script.js", {path: "vendor.js", external: {packageName: "vendor", variableName: "Vendor"}}],
            tags: ["extra.css", {path: "extra.module", type: "js"}],
            metas: {
                attributes: {name: "description", content: "test", hidden: false, priority: 1},
                path: "meta.png",
                glob: "*.png",
                globPath: "images",
                globFlatten: true,
            },
        });
    });

    test("reads hash and publicPath string shortcuts", () => {
        expect(parseOptions("options", "shortcuts", "page.ts")).toEqual({hash: "v1", publicPath: "/"});
    });

    test("reads hash and publicPath boolean shortcuts", () => {
        expect(parseOptions("options", "boolean-shortcuts", "page.ts")).toEqual({hash: false, publicPath: true});
    });

    test("leaves omitted view options for later defaults and ignores the runtime render function", () => {
        expect(parseOptions("options", "defaults", "page.ts")).toEqual({});
    });

    test("reads a meta object", () => {
        expect(parseOptions("options", "object", "page.ts")).toEqual({metas: {attributes: {charset: "utf-8"}}});
    });

    test("reads an array of meta objects", () => {
        expect(parseOptions("options", "array", "page.ts")).toEqual({
            metas: [{attributes: {name: "description", content: "Static metadata"}}],
        });
    });

    test("reads an empty meta array", () => {
        expect(parseOptions("options", "empty-array", "page.ts")).toEqual({metas: []});
    });

    test.each([
        ["meta-string", /Expected a meta object with nonempty attributes, or an array of such objects/],
        ["meta-strings", /Expected a meta object with nonempty attributes, or an array of such objects/],
        ["meta-mixed", /Expected a meta object with nonempty attributes, or an array of such objects/],
        ["meta-empty", /nonempty attributes object/],
        ["meta-missing", /meta object with nonempty attributes/],
        ["meta-null", /meta object with nonempty attributes/],
        ["meta-invalid-attribute", /meta object with nonempty attributes/],
        ["meta-nonfinite-attribute", /Number must be finite/],
    ])("rejects %s and identifies its field and source file", (scenario, message) => {
        expect(() => parseOptions("invalid", `${scenario}.ts`)).toThrow("Invalid options metas");
        expect(() => parseOptions("invalid", `${scenario}.ts`)).toThrow(`${scenario}.ts`);
        expect(() => parseOptions("invalid", `${scenario}.ts`)).toThrow(message);
    });

    test.each(["as", "title", "template"])("rejects an empty %s value", field => {
        expect(() => parseOptions("invalid", `${field}.ts`)).toThrow(`Invalid options ${field}`);
    });

    test("rejects the files selector instead of dropping it", () => {
        expect(() => parseOptions("invalid", "files.ts")).toThrow(
            /Invalid options files.*files.ts.*entrypoint selects its HTML file/
        );
    });

    test.each([
        ["add-hash", "addHash"],
        ["add-public-path", "addPublicPath"],
        ["hash", "hash"],
        ["public-path", "publicPath"],
        ["nested-function", "scripts[0].hash"],
    ])("rejects the nonstatic %s option through the real reader", (scenario, field) => {
        expect(() => parseOptions("invalid", `${scenario}.ts`)).toThrow(`${field} must be statically known`);
    });
});
