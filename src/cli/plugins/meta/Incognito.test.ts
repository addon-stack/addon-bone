import Incognito from "./Incognito";
import {ManifestIncognito} from "@typing/manifest";

describe("Incognito meta", () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {...OLD_ENV};
        delete (process.env as any).INCOGNITO;
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    const makeConfig = (incognito: any): any => ({incognito});

    test("returns direct valid enum value", () => {
        const meta = new Incognito(makeConfig(ManifestIncognito.Split));
        expect(meta.getResolved()).toBe(ManifestIncognito.Split);
    });

    test("returns undefined for invalid direct value", () => {
        const meta = new Incognito(makeConfig("invalid" as any));
        expect(meta.getResolved()).toBeUndefined();
    });

    test("resolves from env var when key provided", () => {
        process.env.INCOGNITO = ManifestIncognito.Spanning;
        const meta = new Incognito(makeConfig("INCOGNITO"));
        expect(meta.getResolved()).toBe(ManifestIncognito.Spanning);
    });

    test("returns undefined when env var is invalid", () => {
        process.env.INCOGNITO = "wrong";
        const meta = new Incognito(makeConfig("INCOGNITO"));
        expect(meta.getResolved()).toBeUndefined();
    });

    test("returns value from function (valid enum)", () => {
        const meta = new Incognito(makeConfig(() => ManifestIncognito.NotAllowed));
        expect(meta.getResolved()).toBe(ManifestIncognito.NotAllowed);
    });

    test("returns undefined when function returns undefined", () => {
        const meta = new Incognito(makeConfig(() => undefined));
        expect(meta.getResolved()).toBeUndefined();
    });
});
