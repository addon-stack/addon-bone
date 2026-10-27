import path from "path";
import {createIntegrationFixture} from "../../utils/fixture";
import {waitFor} from "../utils/browser";
import {startBrowserSession, type BrowserSession} from "../utils/session";
import {startIntegrationSite, type IntegrationSite} from "../utils/site";

export const verifySidebar = async (browser: "chrome" | "firefox", manifestVersion: 2 | 3): Promise<void> => {
    const fixture = await createIntegrationFixture(
        ADNBN_TEST_ROOT,
        path.join(ADNBN_TEST_ROOT, "tests/integration/build/sidebar/fixture")
    );
    let session: BrowserSession | undefined;
    let site: IntegrationSite | undefined;

    try {
        const directory = await fixture.build({browser, manifestVersion});
        site = await startIntegrationSite(path.join(fixture.directory, "site"));
        session = await startBrowserSession(browser, ADNBN_TEST_ROOT, directory);
        await session.navigate(site.origin);

        const text = await waitFor(
            () => session!.evaluate('document.getElementById("sidebar-results")?.textContent || undefined'),
            15_000,
            "sidebar switching and rendered document reports"
        );
        const result = JSON.parse(text);
        const supported = browser === "firefox";

        expect(result.error).toBeUndefined();
        expect(result.canSetTitle).toBe(supported);
        expect(result.canGetTitle).toBe(supported);
        expect(result.canSetIcon).toBe(supported);
        expect(["Open account", "Ouvrir le compte"]).toContain(result.translated);
        expect(result.initial).toBe(supported ? result.translated : null);
        expect(result.initialPath).toMatch(/sidebar\.html$/);
        expect(result.switches.map((item: {target: string}) => item.target)).toEqual(["global", "tab"]);

        for (const {target, states} of result.switches) {
            expect(states).toHaveLength(5);

            for (const [index, alias, title] of [
                [0, "preserve", "Keep this label"],
                [1, "settings", "Open settings"],
                [2, "empty", ""],
                [3, "missing", ""],
                [4, "sidebar", result.translated],
            ] as const) {
                expect(states[index]).toEqual({
                    alias,
                    title: supported ? title : null,
                    path: expect.stringMatching(alias === "sidebar" ? /sidebar\.html$/ : `${alias}\\.sidebar\\.html$`),
                    globalTitle: target === "tab" && supported ? result.translated : null,
                    globalPath: target === "tab" ? result.initialPath : null,
                });
            }
        }

        expect(result.globalAfterTab).toBe(supported ? result.translated : null);
        expect(result.globalPathAfterTab).toMatch(/sidebar\.html$/);
        expect(result.toolbarTitle).toBe("Independent toolbar");
        expect(result.entries).toEqual({
            sidebar: {path: "sidebar.html", label: "@sidebar.account", icon: "account"},
            settings: {path: "settings.sidebar.html", label: "Open settings", icon: "settings"},
            preserve: {path: "preserve.sidebar.html"},
            empty: {path: "empty.sidebar.html", label: ""},
            missing: {path: "missing.sidebar.html", label: "@sidebar.missing"},
        });
        expect(result.views).toEqual([
            {kind: "sidebar-view", alias: "sidebar", documentTitle: "Account document", propTitle: "Account document"},
            {
                kind: "sidebar-view",
                alias: "settings",
                documentTitle: "Settings document",
                propTitle: "Settings document",
            },
            {kind: "sidebar-view", alias: "empty", documentTitle: "Addon"},
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
