import path from "path";

import RelayParser from "./RelayParser";

import type {ReadonlyConfig} from "@typing/config";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtures = path.resolve(__dirname, "tests", "fixtures", "relay");

const parser = new RelayParser({rootDir} as ReadonlyConfig);

const file = (...parts: string[]) => {
    const filename = path.join(fixtures, ...parts);

    return {
        file: filename,
        import: filename,
    };
};

describe("RelayParser", () => {
    test("reads imported isolation objects and enum injectors through the shared option reader", () => {
        expect(parser.options(file("options", "isolation", "imported.relay.ts"))).toMatchObject({
            isolation: {type: "shadow", mode: "closed"},
            method: "messaging",
        });
    });
    test("reports the unresolved nested field in Relay options", () => {
        const target = file("invalid", "dynamic-isolation.relay.ts");
        expect(() => parser.options(target)).toThrow(/isolation.mode must be statically known/);
        expect(() => parser.options(target)).toThrow(target.file);
    });
    test("preserves Shadow options and shares content validation", () => {
        expect(parser.options(file("options", "isolation", "shadow.relay.ts"))).toMatchObject({
            isolation: {type: "shadow", mode: "closed"},
        });
        expect(() => parser.options(file("invalid", "shadow.relay.ts"))).toThrow(/isolation.mode is not supported/);
    });
    test.each(["function.relay.ts", "named-render.relay.ts", "imported.relay.ts"])(
        "treats %s as init rather than a content renderer",
        name => {
            expect(parser.options(file("options", "default-init", name))).toMatchObject({
                isolation: {type: "iframe", page: "panel"},
            });
        }
    );
    test("still rejects an explicit Relay renderer alongside frame navigation", () => {
        expect(() => parser.options(file("invalid", "frame-render.relay.ts"))).toThrow(
            /cannot be combined with render/
        );
    });
    test("preserves Relay isolation and frame build options", () => {
        const options = parser.options(file("options", "isolation", "relay.ts"));
        expect(options.isolation).toEqual({type: "iframe", page: "panel", width: "100%", height: 150});
    });
    test("parses the all-frame response capability from a real entrypoint file", () => {
        expect(parser.options(file("options", "all-frames", "relay.ts"))).toEqual(
            expect.objectContaining({
                method: "messaging",
                allFrames: "all",
            })
        );
    });
});
