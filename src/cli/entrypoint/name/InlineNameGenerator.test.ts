import InlineNameGenerator from "./InlineNameGenerator";

import {EntrypointFile, EntrypointType} from "@typing/entrypoint";

const file = (path: string): EntrypointFile => ({file: path, import: path});

describe("InlineNameGenerator", () => {
    test("keeps names inline without the entrypoint suffix", () => {
        expect(new InlineNameGenerator(EntrypointType.Page).name("help")).toBe("help");
    });

    test("disambiguates colliding names with a numeric suffix", () => {
        const generator = new InlineNameGenerator(EntrypointType.Page);

        expect(generator.name("help")).toBe("help");
        expect(generator.name("help")).toBe("help1");
        expect(generator.name("help")).toBe("help2");
    });

    test("pushes names off reserved words", () => {
        const generator = new InlineNameGenerator(EntrypointType.Page).reserve(EntrypointType.Sandbox);

        expect(generator.name("sandbox")).toBe("sandbox1");
    });

    test("derives an inline name from a file", () => {
        expect(new InlineNameGenerator(EntrypointType.Page).file(file("/project/src/help.page.ts"))).toBe("help");
    });

    test("reset keeps reserved words but forgets generated names", () => {
        const generator = new InlineNameGenerator(EntrypointType.Page).reserve(EntrypointType.Sandbox);

        expect(generator.name("sandbox")).toBe("sandbox1");
        expect(generator.name("help")).toBe("help");

        generator.reset();

        expect(generator.name("sandbox")).toBe("sandbox1");
        expect(generator.name("help")).toBe("help");
    });

    test("likely matches the entrypoint type or names ending in a digit", () => {
        const generator = new InlineNameGenerator(EntrypointType.Page);

        expect(generator.likely("page")).toBe(true);
        expect(generator.likely("help1")).toBe(true);
        expect(generator.likely("help")).toBe(false);
        expect(generator.likely()).toBe(false);
    });
});
