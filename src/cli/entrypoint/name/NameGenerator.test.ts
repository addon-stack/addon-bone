import NameGenerator from "./NameGenerator";

import {EntrypointFile, EntrypointType} from "@typing/entrypoint";

const file = (path: string): EntrypointFile => ({file: path, import: path});

describe("NameGenerator", () => {
    test("suffixes a name with the entrypoint type", () => {
        expect(new NameGenerator(EntrypointType.Page).name("docs")).toBe("docs.page");
    });

    test("keeps a name equal to the entrypoint type unsuffixed", () => {
        expect(new NameGenerator(EntrypointType.Page).name("page")).toBe("page");
    });

    test("disambiguates colliding names with a counter", () => {
        const generator = new NameGenerator(EntrypointType.Page);

        expect(generator.name("docs")).toBe("docs.page");
        expect(generator.name("docs")).toBe("docs1.page");
        expect(generator.name("docs")).toBe("docs2.page");
    });

    test("disambiguates a name equal to the entrypoint type with a leading counter", () => {
        const generator = new NameGenerator(EntrypointType.Page);

        expect(generator.name("page")).toBe("page");
        expect(generator.name("page")).toBe("1.page");
    });

    test("derives a name from a plain file", () => {
        expect(new NameGenerator(EntrypointType.Page).file(file("/project/src/docs.ts"))).toBe("docs.page");
    });

    test("strips the entrypoint infix from a file name", () => {
        expect(new NameGenerator(EntrypointType.Page).file(file("/project/src/docs.page.ts"))).toBe("docs.page");
    });

    test("uses the directory name for index files", () => {
        expect(new NameGenerator(EntrypointType.Page).file(file("/project/src/docs/index.ts"))).toBe("docs.page");
    });

    test("skips reserved names", () => {
        expect(new NameGenerator(EntrypointType.Page).reserve("docs.page").name("docs")).toBe("docs1.page");
    });

    test("throws when a name is reserved twice", () => {
        const generator = new NameGenerator(EntrypointType.Page).reserve("popup");

        expect(() => generator.reserve("popup")).toThrow('Entrypoint name "popup" is already in use.');
    });

    test("reset forgets generated names", () => {
        const generator = new NameGenerator(EntrypointType.Page);

        expect(generator.name("docs")).toBe("docs.page");

        generator.reset();

        expect(generator.name("docs")).toBe("docs.page");
    });

    test("likely matches entrypoint-shaped names", () => {
        const generator = new NameGenerator(EntrypointType.Page);

        expect(generator.likely("page")).toBe(true);
        expect(generator.likely("docs.page")).toBe(true);
        expect(generator.likely("docs")).toBe(false);
        expect(generator.likely()).toBe(false);
    });
});
