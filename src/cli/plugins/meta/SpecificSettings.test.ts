import {DataCollectionPermission} from "@typing/browser";
import SpecificSettings from "./SpecificSettings";

describe("SpecificSettings meta", () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {...OLD_ENV};
        delete (process.env as any).SPECIFIC;
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    const makeConfig = (specific: any): any => ({specific});

    test("returns direct valid object", () => {
        const specific = {
            gecko: {
                id: "@my-extension.example",
                strictMinVersion: "58.0",
                strictMaxVersion: "100.*",
                updateUrl: "https://example.com/updates.json",
                dataCollectionPermissions: {
                    required: [DataCollectionPermission.WebsiteActivity],
                    optional: [DataCollectionPermission.AuthenticationInfo, DataCollectionPermission.SearchTerms],
                },
            },
            geckoAndroid: {
                strictMinVersion: "109.0",
                strictMaxVersion: "120.*",
            },
            safari: {
                strictMinVersion: "14",
                strictMaxVersion: "20",
            },
        };

        const meta = new SpecificSettings(makeConfig(specific));
        expect(meta.getResolved()).toEqual(specific);
    });

    test("returns undefined for invalid dataCollectionPermissions (bad enum value)", () => {
        const specific = {
            gecko: {
                dataCollectionPermissions: {
                    required: ["invalid-permission" as any],
                },
            },
        };

        const meta = new SpecificSettings(makeConfig(specific));
        expect(meta.getResolved()).toBeUndefined();
    });

    test("returns undefined for invalid dataCollectionPermissions (extra field)", () => {
        const specific = {
            gecko: {
                dataCollectionPermissions: {
                    required: [DataCollectionPermission.WebsiteActivity],
                    foo: "bar", // extra field not allowed by strict schema
                } as any,
            },
        };

        const meta = new SpecificSettings(makeConfig(specific));
        expect(meta.getResolved()).toBeUndefined();
    });

    test("returns undefined for invalid direct value (bad URL)", () => {
        const specific = {
            gecko: {
                id: "@my-extension.example",
                updateUrl: "not-a-url",
            },
        };

        const meta = new SpecificSettings(makeConfig(specific));
        expect(meta.getResolved()).toBeUndefined();
    });

    test("returns undefined for invalid direct value (extra field)", () => {
        const specific = {
            gecko: {
                id: "@my-extension.example",
                foo: "bar", // extra field not allowed by strict schema
            },
        };

        const meta = new SpecificSettings(makeConfig(specific));
        expect(meta.getResolved()).toBeUndefined();
    });

    test("returns value from function (valid object)", () => {
        const specific = {
            safari: {strictMinVersion: "14"},
        };
        const meta = new SpecificSettings(makeConfig(() => specific));
        expect(meta.getResolved()).toEqual(specific);
    });

    test("returns undefined when function returns undefined", () => {
        const meta = new SpecificSettings(makeConfig(() => undefined));
        expect(meta.getResolved()).toBeUndefined();
    });

    test("env set: key provided but env is string → undefined", () => {
        // AbstractMeta treats string value as an env key and fetches process.env[key],
        // but getEnv returns a string, while schema expects an object. Should be undefined.
        process.env.SPECIFIC = "{gecko:{}}" as any;
        const meta = new SpecificSettings(makeConfig("SPECIFIC"));
        expect(meta.getResolved()).toBeUndefined();
    });
});
