jest.mock("#adnbn/popup", () => ({
    aliases: {
        plain: {path: "plain.html", tooltip: "Open account", icon: "account"},
        localized: {path: "account.html", tooltip: "@popup.account"},
        empty: {path: "empty.html", tooltip: ""},
        emptyTranslation: {path: "empty-translation.html", tooltip: "@popup.empty"},
        missingTranslation: {path: "missing-translation.html", tooltip: "@popup.missing"},
        unchanged: {path: "unchanged.html", icon: "account"},
        invalid: {tooltip: "No path"},
    },
}));

jest.mock("#adnbn/icon", () => ({groups: {account: {16: "account-16.png"}}}));

import {createTabFixture} from "@addon-core/browser/testing";
import {getBrowserTest} from "@tests/browser-harness/session";
import {changePopup, getPopups} from "./popup";

describe("changePopup", () => {
    beforeEach(() => {
        const {harness} = getBrowserTest();
        harness.runtime.setManifest({name: "Popup test", version: "1.0.0", manifest_version: 3});
        const action = harness.configurable.chrome.action;
        action.setPopup.setResult(undefined);
        action.setTitle.setResult(undefined);
        action.setIcon.setResult(undefined);
        harness.configurable.chrome.i18n.getMessage.setImplementation(key => (key === "popup_account" ? "Compte" : ""));
    });

    test.each([
        {target: "global", tab: undefined, tabId: undefined},
        {target: "tab ID", tab: 7, tabId: 7},
    ])("sets translated or literal tooltips for $target and preserves omitted ones", async ({tab, tabId}) => {
        const {harness} = getBrowserTest();
        const action = harness.configurable.chrome.action;
        const message = harness.configurable.chrome.i18n.getMessage;

        await changePopup("plain", tab);

        expect(action.setPopup.calls.at(-1)?.args[0]).toEqual({popup: "plain.html", tabId});
        expect(action.setTitle.calls.at(-1)?.args[0]).toEqual({title: "Open account", tabId});
        expect(action.setIcon.calls.at(-1)?.args[0]).toEqual({path: {16: "account-16.png"}, tabId});
        expect(action.setPopup.calls[0].sequence).toBeLessThan(action.setTitle.calls[0].sequence);
        expect(action.setTitle.calls[0].sequence).toBeLessThan(action.setIcon.calls[0].sequence);
        expect(message.calls).toHaveLength(0);

        await changePopup("localized", tab);

        expect(message.calls.at(-1)?.args).toEqual(["popup_account"]);
        expect(action.setTitle.calls.at(-1)?.args[0]).toEqual({title: "Compte", tabId});

        for (const alias of ["empty", "emptyTranslation", "missingTranslation"]) {
            await changePopup(alias, tab);

            expect(action.setTitle.calls.at(-1)?.args[0]).toEqual({title: "", tabId});
        }

        const titleCalls = action.setTitle.calls.length;
        const messageCalls = message.calls.length;

        await changePopup("unchanged", tab);

        expect(action.setPopup.calls.at(-1)?.args[0]).toEqual({popup: "unchanged.html", tabId});
        expect(action.setTitle.calls).toHaveLength(titleCalls);
        expect(message.calls).toHaveLength(messageCalls);
        expect(action.setIcon.calls).toHaveLength(2);
    });

    test.each([
        {target: "zero tab ID", tab: 0, tabId: 0},
        {target: "Tab object", tab: createTabFixture({id: 7}), tabId: 7},
    ])("normalizes $target for every action update", async ({tab, tabId}) => {
        await changePopup("plain", tab);

        const action = getBrowserTest().harness.configurable.chrome.action;

        expect(action.setPopup.calls[0].args[0]).toEqual({popup: "plain.html", tabId});
        expect(action.setTitle.calls[0].args[0]).toEqual({title: "Open account", tabId});
        expect(action.setIcon.calls[0].args[0]).toEqual({path: {16: "account-16.png"}, tabId});
    });

    test("uses browserAction for MV2", async () => {
        const {harness} = getBrowserTest();
        harness.runtime.setManifest({name: "Popup test", version: "1.0.0", manifest_version: 2});
        const action = harness.configurable.chrome.browserAction;
        action.setPopup.setResult(undefined);
        action.setTitle.setResult(undefined);
        action.setIcon.setResult(undefined);

        await changePopup("plain", 7);

        expect(action.setPopup.calls[0].args[0]).toEqual({popup: "plain.html", tabId: 7});
        expect(action.setTitle.calls[0].args[0]).toEqual({title: "Open account", tabId: 7});
        expect(action.setIcon.calls[0].args[0]).toEqual({path: {16: "account-16.png"}, tabId: 7});
    });

    test.each([
        {method: "setPopup", titleCalls: 0, iconCalls: 0},
        {method: "setTitle", titleCalls: 1, iconCalls: 0},
        {method: "setIcon", titleCalls: 1, iconCalls: 1},
    ] as const)("propagates $method failures without continuing", async ({method, titleCalls, iconCalls}) => {
        const action = getBrowserTest().harness.configurable.chrome.action;
        action[method].failNext(new Error("Browser refused the update"));

        await expect(changePopup("plain", 7)).rejects.toThrow("Browser refused the update");

        expect(action.setPopup.calls).toHaveLength(1);
        expect(action.setTitle.calls).toHaveLength(titleCalls);
        expect(action.setIcon.calls).toHaveLength(iconCalls);
    });

    test.each([
        {alias: "unknown", error: 'Not found popup: "unknown"'},
        {alias: "invalid", error: 'Not found popup path: "invalid"'},
    ])("rejects $alias before calling the browser", async ({alias, error}) => {
        await expect(changePopup(alias)).rejects.toThrow(error);

        const action = getBrowserTest().harness.configurable.chrome.action;

        expect(action.setPopup.calls).toHaveLength(0);
        expect(action.setTitle.calls).toHaveLength(0);
        expect(action.setIcon.calls).toHaveLength(0);
    });
});

test("getPopups exposes unresolved tooltip metadata", () => {
    expect(getPopups().get("localized")).toEqual({path: "account.html", tooltip: "@popup.account"});
    expect(getBrowserTest().harness.configurable.chrome.i18n.getMessage.calls).toHaveLength(0);
});
