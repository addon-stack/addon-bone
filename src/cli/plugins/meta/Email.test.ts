import Email from "./Email";

describe("Email meta", () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {...OLD_ENV};
        delete process.env.EMAIL;
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    const makeConfig = (email: any): any => ({email});

    test("returns direct valid email", () => {
        const config: any = makeConfig("test@example.com");
        const meta = new Email(config);
        expect(meta.getResolved()).toBe("test@example.com");
    });

    test("resolves from env var when key provided", () => {
        process.env.EMAIL = "env@example.com";
        const config: any = makeConfig("EMAIL");
        const meta = new Email(config);
        expect(meta.getResolved()).toBe("env@example.com");
    });

    test("returns undefined for invalid direct value", () => {
        const config: any = makeConfig("not-an-email");
        const meta = new Email(config);
        expect(meta.getResolved()).toBeUndefined();
    });

    test("returns undefined when env var is invalid", () => {
        process.env.EMAIL = "not-an-email";
        const config: any = makeConfig("EMAIL");
        const meta = new Email(config);
        expect(meta.getResolved()).toBeUndefined();
    });

    test("returns undefined when function returns undefined", () => {
        const config: any = makeConfig(() => undefined);
        const meta = new Email(config);
        expect(meta.getResolved()).toBeUndefined();
    });
});
