jest.mock("#adnbn/sidebar", () => ({
    aliases: {
        plain: {path: "plain.html", label: "Open account", icon: "account"},
        localized: {path: "account.html", label: "@sidebar.account", icon: "account"},
        empty: {path: "empty.html", label: ""},
        emptyTranslation: {path: "empty-translation.html", label: "@sidebar.empty"},
        missingTranslation: {path: "missing-translation.html", label: "@sidebar.missing"},
        unchanged: {path: "unchanged.html"},
        invalid: {label: "No path"},
    },
}));

jest.mock("#adnbn/icon", () => ({groups: {account: {16: "account-16.png"}}}));

import {createTabFixture} from "@addon-core/browser/testing";
import {getBrowserTest} from "@tests/browser-harness/session";
import {changeSidebar, getSidebars} from "./sidebar";

describe("changeSidebar in Firefox", () => {
    beforeEach(() => {
        const session = getBrowserTest();
        session.useContext(session.context, "firefox");
        session.harness.sidebar.firefox.setPanel.setResult(undefined);
        session.harness.sidebar.firefox.setTitle.setResult(undefined);
        session.harness.sidebar.firefox.setIcon.setResult(undefined);
        session.harness.configurable.active.i18n.getMessage.setImplementation(key =>
            key === "sidebar_account" ? "Compte" : ""
        );
    });

    test("updates global paths, labels and icons, resolving translations and preserving omitted values", async () => {
        const api = getBrowserTest().harness.sidebar.firefox;
        const message = getBrowserTest().harness.configurable.active.i18n.getMessage;

        expect(getSidebars().get("localized")).toEqual({
            path: "account.html",
            label: "@sidebar.account",
            icon: "account",
        });
        expect(message.calls).toHaveLength(0);

        await changeSidebar("plain");

        expect(api.setPanel.calls[0].args[0]).toEqual({panel: "plain.html", tabId: undefined});
        expect(api.setTitle.calls[0].args[0]).toEqual({title: "Open account", tabId: undefined});
        expect(api.setIcon.calls[0].args[0]).toEqual({path: {16: "account-16.png"}, tabId: undefined});
        expect(api.setPanel.calls[0].sequence).toBeLessThan(api.setTitle.calls[0].sequence);
        expect(api.setTitle.calls[0].sequence).toBeLessThan(api.setIcon.calls[0].sequence);
        expect(message.calls).toHaveLength(0);

        await changeSidebar("localized");

        expect(message.calls.at(-1)?.args).toEqual(["sidebar_account"]);
        expect(api.setTitle.calls.at(-1)?.args[0]).toEqual({title: "Compte", tabId: undefined});

        for (const alias of ["empty", "emptyTranslation", "missingTranslation"]) {
            await changeSidebar(alias);

            expect(api.setTitle.calls.at(-1)?.args[0]).toEqual({title: "", tabId: undefined});
        }

        const titleCalls = api.setTitle.calls.length;
        const messageCalls = message.calls.length;

        await changeSidebar("unchanged");

        expect(api.setPanel.calls.at(-1)?.args[0]).toEqual({panel: "unchanged.html", tabId: undefined});
        expect(api.setTitle.calls).toHaveLength(titleCalls);
        expect(message.calls).toHaveLength(messageCalls);
        expect(api.setIcon.calls).toHaveLength(2);
    });

    test.each([0, createTabFixture({id: 7})])("passes target %j to every sidebar update", async tab => {
        const tabId = typeof tab === "object" ? tab.id : tab;
        const api = getBrowserTest().harness.sidebar.firefox;

        await changeSidebar("plain", tab);

        expect(api.setPanel.calls[0].args[0]).toEqual({panel: "plain.html", tabId});
        expect(api.setTitle.calls[0].args[0]).toEqual({title: "Open account", tabId});
        expect(api.setIcon.calls[0].args[0]).toEqual({path: {16: "account-16.png"}, tabId});
    });

    test("checks the title capability even in a browser with sidebarAction", async () => {
        const {harness} = getBrowserTest();
        harness.capabilities.set("browser.sidebarAction.setTitle", false);

        await expect(changeSidebar("localized")).resolves.toBeUndefined();

        expect(harness.sidebar.firefox.setPanel.calls).toHaveLength(1);
        expect(harness.sidebar.firefox.setTitle.calls).toHaveLength(0);
        expect(harness.sidebar.firefox.setIcon.calls).toHaveLength(1);
        expect(harness.configurable.active.i18n.getMessage.calls).toHaveLength(0);
    });

    test("preserves path and label updates when the icon capability is unavailable", async () => {
        const {harness} = getBrowserTest();
        harness.capabilities.set("browser.sidebarAction.setIcon", false);

        await expect(changeSidebar("plain")).resolves.toBeUndefined();

        expect(harness.sidebar.firefox.setPanel.calls).toHaveLength(1);
        expect(harness.sidebar.firefox.setTitle.calls).toHaveLength(1);
        expect(harness.sidebar.firefox.setIcon.calls).toHaveLength(0);
    });

    test.each(["setPanel", "setTitle", "setIcon"] as const)("propagates %s errors", async method => {
        const api = getBrowserTest().harness.sidebar.firefox;
        api[method].failNext(new Error("Browser refused the update"));

        await expect(changeSidebar("plain")).rejects.toThrow("Browser refused the update");

        expect(api.setPanel.calls).toHaveLength(1);
        expect(api.setTitle.calls).toHaveLength(method === "setPanel" ? 0 : 1);
        expect(api.setIcon.calls).toHaveLength(method === "setIcon" ? 1 : 0);
    });

    test.each([
        {alias: "unknown", error: 'Not found sidebar: "unknown"'},
        {alias: "invalid", error: 'Not found sidebar path: "invalid"'},
    ])("rejects $alias before calling the browser", async ({alias, error}) => {
        await expect(changeSidebar(alias)).rejects.toThrow(error);

        expect(getBrowserTest().harness.sidebar.firefox.setPanel.calls).toHaveLength(0);
    });
});

test("updates Opera paths and labels while skipping unsupported icons", async () => {
    const session = getBrowserTest();
    session.useContext(session.context, "opera");
    const api = session.harness.sidebar.opera;
    api.setPanel.setResult(undefined);
    api.setTitle.setResult(undefined);

    await changeSidebar("plain", 7);

    expect(api.setPanel.calls[0].args[0]).toEqual({panel: "plain.html", tabId: 7});
    expect(api.setTitle.calls[0].args[0]).toEqual({title: "Open account", tabId: 7});
    expect(api.setIcon.calls).toHaveLength(0);
});

test.each([undefined, 7])("switches Chrome paths without unsupported label or icon updates for tab %s", async tabId => {
    const {harness} = getBrowserTest();
    harness.sidebar.sidePanel.setOptions.setResult(undefined);

    await expect(changeSidebar("localized", tabId)).resolves.toBeUndefined();

    expect(harness.sidebar.sidePanel.setOptions.calls[0].args[0]).toEqual({path: "account.html", tabId});
    expect(harness.configurable.active.i18n.getMessage.calls).toHaveLength(0);
});
