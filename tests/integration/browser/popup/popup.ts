import {copyFile} from "fs/promises";
import path from "path";
import {createIntegrationFixture} from "../../utils/fixture";
import {waitFor} from "../utils/browser";
import {startBrowserSession, type BrowserSession} from "../utils/session";
import {startIntegrationSite, type IntegrationSite} from "../utils/site";

export const verifyPopup = async (
    browser: "chrome" | "firefox",
    manifestVersion: 2 | 3,
    tooltip: "literal" | "omitted"
): Promise<void> => {
    const fixture = await createIntegrationFixture(
        ADNBN_TEST_ROOT,
        path.join(ADNBN_TEST_ROOT, "tests/integration/build/popup/fixture")
    );
    let session: BrowserSession | undefined;
    let site: IntegrationSite | undefined;

    try {
        if (tooltip === "omitted") {
            await copyFile(
                path.join(fixture.directory, "variants", "settings-without-tooltip.ts"),
                path.join(fixture.directory, "src", "settings.popup.ts")
            );
        }

        const directory = await fixture.build({browser, manifestVersion});
        site = await startIntegrationSite(path.join(fixture.directory, "site"));
        session = await startBrowserSession(browser, ADNBN_TEST_ROOT, directory);
        await session.navigate(site.origin);

        const text = await waitFor(
            () => session!.evaluate('document.getElementById("popup-results")?.textContent || undefined'),
            15_000,
            "popup switching and rendered document reports"
        );
        const result = JSON.parse(text);

        expect(result.error).toBeUndefined();
        expect(["Open account", "Ouvrir le compte"]).toContain(result.translated);
        expect(result.initial).toBe(result.translated);
        expect(result.initialPopup).toMatch(/\/popup\.html$/);
        expect(result.settings).toBe(tooltip === "literal" ? "Open settings" : result.translated);
        expect(result.account).toBe(result.translated);
        expect(result.tabSettings).toBe(tooltip === "literal" ? "Open settings" : "Keep this tab");
        expect(result.tabPath).toMatch(/\/settings\.popup\.html$/);
        expect(result.globalAfterTab).toBe(result.translated);
        expect(result.tabAccount).toBe(result.translated);
        expect(result.entries).toEqual({
            popup: {path: "popup.html", tooltip: "@popup.account"},
            settings: {
                path: "settings.popup.html",
                ...(tooltip === "literal" ? {tooltip: "Open settings"} : {}),
            },
        });
        expect(result.views).toEqual([
            {kind: "popup-view", alias: "popup", documentTitle: "Account document", propTitle: "Account document"},
            {kind: "popup-view", alias: "settings", documentTitle: "Settings document", propTitle: "Settings document"},
        ]);
        expect(session.errors).toEqual([]);
    } finally {
        try {
            await session?.close();
        } finally {
            await site?.close();
            await fixture.dispose();
        }
    }
};
