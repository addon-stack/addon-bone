import {collectPermissions} from "./permissions";

describe("collectPermissions", () => {
    test("unites every kind of permission across entrypoints without duplicates", () => {
        expect(
            collectPermissions([
                {permissions: ["storage", "tabs"], hostPermissions: ["https://*.example.com/*"]},
                {permissions: ["tabs", "history"], optionalPermissions: ["topSites"]},
                {optionalHostPermissions: ["https://other.test/*"], hostPermissions: ["https://*.example.com/*"]},
            ])
        ).toEqual({
            permissions: new Set(["storage", "tabs", "history"]),
            optionalPermissions: new Set(["topSites"]),
            hostPermissions: new Set(["https://*.example.com/*"]),
            optionalHostPermissions: new Set(["https://other.test/*"]),
        });
    });

    test("returns empty sets when no entrypoint declares permissions", () => {
        expect(collectPermissions([{}, {}])).toEqual({
            permissions: new Set(),
            optionalPermissions: new Set(),
            hostPermissions: new Set(),
            optionalHostPermissions: new Set(),
        });
        expect(collectPermissions([])).toEqual(collectPermissions([{}]));
    });
});
