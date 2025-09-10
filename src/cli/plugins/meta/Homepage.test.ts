import Homepage from "./Homepage";

describe("Homepage meta", () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {...OLD_ENV};
        delete process.env.HOMEPAGE;
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    const makeConfig = (homepage: any): any => ({homepage});

    test("returns direct valid url", () => {
        const meta = new Homepage(makeConfig("https://example.com/path?x=1#frag"));
        expect(meta.getResolved()).toBe("https://example.com/path?x=1#frag");
    });

    test("resolves from env var when key provided", () => {
        process.env.HOMEPAGE = "https://env.example.com";
        const meta = new Homepage(makeConfig("HOMEPAGE"));
        expect(meta.getResolved()).toBe("https://env.example.com");
    });

    test("returns undefined for invalid direct value", () => {
        const meta = new Homepage(makeConfig("not-a-url"));
        expect(meta.getResolved()).toBeUndefined();
    });

    test("returns undefined when env var is invalid", () => {
        process.env.HOMEPAGE = "not-a-url";
        const meta = new Homepage(makeConfig("HOMEPAGE"));
        expect(meta.getResolved()).toBeUndefined();
    });

    test("returns undefined when function returns undefined", () => {
        const meta = new Homepage(makeConfig(() => undefined));
        expect(meta.getResolved()).toBeUndefined();
    });
});
