import {PermissionsSchema} from "./permissions";

import type {PermissionsOptions} from "@typing/permissions";

describe("PermissionsSchema", () => {
    test("accepts install-time and optional API and host permissions", () => {
        const permissions: Required<PermissionsOptions> = {
            permissions: ["storage", "tabs"],
            optionalPermissions: ["history"],
            hostPermissions: ["https://*.example.com/*"],
            optionalHostPermissions: ["https://other.test/*"],
        };

        expect(PermissionsSchema.parse(permissions)).toEqual(permissions);
    });

    test("leaves every field optional", () => {
        expect(PermissionsSchema.parse({})).toEqual({});
    });

    test.each([
        {field: "permissions", value: "tabs"},
        {field: "optionalPermissions", value: {history: true}},
        {field: "hostPermissions", value: [1]},
        {field: "optionalHostPermissions", value: [null]},
    ])("rejects $field that is not an array of strings", ({field, value}) => {
        const result = PermissionsSchema.safeParse({[field]: value});

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path[0]).toBe(field);
    });
});
