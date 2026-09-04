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
    test("parses the all-frame response capability from a real entrypoint file", () => {
        expect(parser.options(file("options", "all-frames", "relay.ts"))).toEqual(
            expect.objectContaining({
                method: "messaging",
                allFrames: "all",
            })
        );
    });

    test("does not project the content shadow option into Relay build options", () => {
        expect(parser.options(file("options", "shadow", "relay.ts"))).not.toHaveProperty("shadow");
    });
});
