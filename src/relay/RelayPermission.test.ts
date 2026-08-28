import {containsPermissions, onPermissionsAdded, onPermissionsRemoved} from "@addon-core/browser";

import RelayPermission, {RelayPermissionGlobalKey} from "./RelayPermission";

import {ContentScriptDeclarative} from "@typing/content";
import {RelayMethod, type RelayOptionsMap} from "@typing/relay";

const mockedContainsPermissions = containsPermissions as jest.MockedFunction<typeof containsPermissions>;
const mockedOnPermissionsAdded = onPermissionsAdded as jest.MockedFunction<typeof onPermissionsAdded>;
const mockedOnPermissionsRemoved = onPermissionsRemoved as jest.MockedFunction<typeof onPermissionsRemoved>;

describe("RelayPermission", () => {
    beforeEach(() => {
        delete globalThis[RelayPermissionGlobalKey];
        mockedContainsPermissions.mockReset();
        mockedOnPermissionsAdded.mockClear();
        mockedOnPermissionsRemoved.mockClear();
    });

    afterEach(() => {
        delete globalThis[RelayPermissionGlobalKey];
    });

    test("checks every Relay stored in its Map", async () => {
        mockedContainsPermissions.mockResolvedValue(true);
        const relays: RelayOptionsMap = new Map([
            [
                "scanner",
                {
                    name: "scanner",
                    method: RelayMethod.Scripting,
                    declarative: ContentScriptDeclarative.Optional,
                    matches: ["https://example.com/*"],
                },
            ],
        ]);

        const permission = RelayPermission.getInstance(relays);
        await Promise.resolve();
        await Promise.resolve();

        expect(mockedContainsPermissions).toHaveBeenCalledWith({
            origins: ["https://example.com/*"],
            permissions: ["scripting"],
        });
        expect(permission.allow("scanner")).toBe(true);
        expect(mockedOnPermissionsAdded).toHaveBeenCalledTimes(1);
        expect(mockedOnPermissionsRemoved).toHaveBeenCalledTimes(1);
    });

    test("returns one started instance for the current runtime context", () => {
        const relays: RelayOptionsMap = new Map([
            [
                "messaging",
                {
                    name: "messaging",
                    method: RelayMethod.Messaging,
                    declarative: false,
                    matches: [],
                },
            ],
        ]);

        const first = RelayPermission.getInstance(relays);
        const second = RelayPermission.getInstance(relays);

        second.start();

        expect(second).toBe(first);
        expect(first.allow("messaging")).toBe(true);
        expect(mockedOnPermissionsAdded).toHaveBeenCalledTimes(1);
        expect(mockedOnPermissionsRemoved).toHaveBeenCalledTimes(1);
    });
});
