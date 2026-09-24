import {getBrowserTest} from "@tests/browser-harness/session";

import RelayPermission from "./RelayPermission";

import {ContentScriptDeclarative} from "@typing/content";
import {RelayMethod, type RelayOptionsMap} from "@typing/relay";

describe("RelayPermission", () => {
    test("checks every Relay stored in its Map", async () => {
        getBrowserTest().harness.permissions.contains.setResult(true);
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

        expect(getBrowserTest().harness.permissions.contains.calls[0].args).toEqual([
            {
                origins: ["https://example.com/*"],
                permissions: ["scripting"],
            },
        ]);
        expect(permission.allow("scanner")).toBe(true);
        expect(getBrowserTest().harness.permissions.onAdded.listenerCount()).toBe(1);
        expect(getBrowserTest().harness.permissions.onRemoved.listenerCount()).toBe(1);
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
        expect(getBrowserTest().harness.permissions.onAdded.listenerCount()).toBe(1);
        expect(getBrowserTest().harness.permissions.onRemoved.listenerCount()).toBe(1);
    });
});

test("refreshes optional Relay permissions after grants and revocations", async () => {
    const {harness} = getBrowserTest();
    const required: chrome.permissions.Permissions = {permissions: ["scripting"], origins: ["https://example.com/*"]};
    const permission = RelayPermission.getInstance(
        new Map([
            [
                "scanner",
                {
                    name: "scanner",
                    method: RelayMethod.Scripting,
                    declarative: ContentScriptDeclarative.Optional,
                    matches: required.origins,
                },
            ],
        ])
    );

    await permission.contains("scanner");
    expect(permission.allow("scanner")).toBe(false);
    await harness.permissions.grant(required);
    expect(permission.allow("scanner")).toBe(true);
    await harness.permissions.revoke(required);
    expect(permission.allow("scanner")).toBe(false);
    expect(harness.permissions.contains.calls).toHaveLength(4);
});

test("does not request the MV3 scripting permission for an MV2 Relay", async () => {
    const {harness} = getBrowserTest();

    harness.runtime.setManifest({manifest_version: 2, name: "MV2 Relay", version: "1.0.0"});
    harness.permissions.set({origins: ["https://example.com/*"]});

    const permission = RelayPermission.getInstance(
        new Map([
            [
                "scanner",
                {
                    name: "scanner",
                    method: RelayMethod.Scripting,
                    declarative: ContentScriptDeclarative.Optional,
                    matches: ["https://example.com/*"],
                },
            ],
        ])
    );

    await expect(permission.contains("scanner")).resolves.toBe(true);
    expect(harness.permissions.contains.calls[0].args).toEqual([{origins: ["https://example.com/*"], permissions: []}]);
    expect(permission.allow("scanner")).toBe(true);
});
