import {filterEnvVars, resolveEnvOptions} from "./utils";
import {EnvReservedKeys} from "../../../types/env";

const baseVars = {
    APP: "myapp",
    BROWSER: "Chrome",
    MODE: "development",
    MANIFEST_VERSION: "3",
    PUBLIC_API_URL: "https://example.com",
    PUBLIC_FEATURE: "on",
    SECRET_TOKEN: "should_not_leak",
    FEATURE_FLAG: "A",
};

describe("dotenv utils - filterEnvVars & resolveEnvOptions", () => {
    test("string prefix filter includes matching keys and always reserved", () => {
        const {filter} = resolveEnvOptions("PUBLIC_");
        const filtered = filterEnvVars(baseVars, filter);
        expect(filtered).toEqual({
            APP: baseVars.APP,
            BROWSER: baseVars.BROWSER,
            MODE: baseVars.MODE,
            MANIFEST_VERSION: baseVars.MANIFEST_VERSION,
            PUBLIC_API_URL: baseVars.PUBLIC_API_URL,
            PUBLIC_FEATURE: baseVars.PUBLIC_FEATURE,
        });
    });

    test("predicate filter includes only those keys where predicate returns true, plus reserved", () => {
        const {filter} = resolveEnvOptions((key: string) => key === "FEATURE_FLAG");
        const filtered = filterEnvVars(baseVars, filter);
        expect(filtered).toEqual({
            APP: baseVars.APP,
            BROWSER: baseVars.BROWSER,
            MODE: baseVars.MODE,
            MANIFEST_VERSION: baseVars.MANIFEST_VERSION,
            FEATURE_FLAG: baseVars.FEATURE_FLAG,
        });
    });

    test("object with filter true - filter selection flag detection", () => {
        const option = {filter: "PUBLIC_", crypt: true} as const;
        const {filter} = resolveEnvOptions(option);
        const filtered = filterEnvVars(baseVars, filter);
        expect(filtered).toEqual({
            APP: baseVars.APP,
            BROWSER: baseVars.BROWSER,
            MODE: baseVars.MODE,
            MANIFEST_VERSION: baseVars.MANIFEST_VERSION,
            PUBLIC_API_URL: baseVars.PUBLIC_API_URL,
            PUBLIC_FEATURE: baseVars.PUBLIC_FEATURE,
        });
    });

    test("empty string filter results in all keys", () => {
        const {filter} = resolveEnvOptions("");
        const filtered = filterEnvVars(baseVars, filter);
        // All keys should be present because empty prefix matches all
        expect(filtered).toEqual(baseVars);
    });

    test("no filter provided (object without filter) results in all keys", () => {
        const {filter} = resolveEnvOptions({});
        const filtered = filterEnvVars(baseVars, filter);
        expect(filtered).toEqual(baseVars);
    });

    test("predicate always false returns only reserved keys", () => {
        const {filter} = resolveEnvOptions(() => false);
        const filtered = filterEnvVars(baseVars, filter);
        const expected: any = {};
        for (const key of EnvReservedKeys) expected[key] = (baseVars as any)[key];
        expect(filtered).toEqual(expected);
    });

    test("string filter with spaces is trimmed", () => {
        const {filter} = resolveEnvOptions("  PUBLIC_  ");
        const filtered = filterEnvVars(baseVars, filter);
        expect(Object.keys(filtered).sort()).toEqual(
            ["APP", "BROWSER", "MODE", "MANIFEST_VERSION", "PUBLIC_API_URL", "PUBLIC_FEATURE"].sort()
        );
    });
});
