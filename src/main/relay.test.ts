jest.mock("#adnbn/relay", () => ({options: {}}));

import {getRelay} from "./relay";
import {options} from "#adnbn/relay";
import {RelayMethod} from "@typing/relay";
import {RelayPermissionGlobalKey} from "@relay/RelayPermission";

// Generated RelayRegistry typing is covered by RelayDeclaration tests; exercise arbitrary runtime maps here.
const getFixtureRelay = getRelay as (name: string, tabId: number) => unknown;

describe("getRelay generated options", () => {
    const permissionDescriptor = Object.getOwnPropertyDescriptor(globalThis, RelayPermissionGlobalKey);

    afterEach(() => {
        for (const name of Object.keys(options)) delete options[name];
        if (permissionDescriptor) Object.defineProperty(globalThis, RelayPermissionGlobalKey, permissionDescriptor);
        else Reflect.deleteProperty(globalThis, RelayPermissionGlobalKey);
    });

    test("creates a proxy from the generated options", () => {
        options.collector = {name: "collector", method: RelayMethod.Messaging};

        expect(getFixtureRelay("collector", 1)).toHaveProperty("__proxy", true);
        expect(() => getFixtureRelay("missing", 1)).toThrow('Failed to get relay "missing"');
    });

    test("preserves the unknown Relay error without configured Relays", () => {
        expect(() => getFixtureRelay("missing", 1)).toThrow('Failed to get relay "missing"');
    });
});
