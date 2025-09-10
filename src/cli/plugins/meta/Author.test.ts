import Author from "./Author";

describe("Author meta", () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {...OLD_ENV};
        delete process.env.AUTHOR;
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    const makeConfig = (author: any): any => ({author});

    test("returns direct non-empty string", () => {
        const meta = new Author(makeConfig("Addon Bone"));
        expect(meta.getResolved()).toBe("Addon Bone");
    });

    test("returns undefined for empty string", () => {
        const meta = new Author(makeConfig(""));
        expect(meta.getResolved()).toBeUndefined();
    });

    test("returns value from function", () => {
        const meta = new Author(makeConfig(() => "Fn Author"));
        expect(meta.getResolved()).toBe("Fn Author");
    });

    test("env not set: returns fallback (the key itself)", () => {
        const meta = new Author(makeConfig("AUTHOR"));
        // Author.getResolved uses getEnv(key, key), so without env it returns key
        expect(meta.getResolved()).toBe("AUTHOR");
    });

    test("env set: resolves to env value", () => {
        process.env.AUTHOR = "ENV Author";
        const meta = new Author(makeConfig("AUTHOR"));
        expect(meta.getResolved()).toBe("ENV Author");
    });
});
