import {copyFile, readFile} from "fs/promises";
import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";

jest.setTimeout(90_000);

test.each([2, 3] as const)("builds independent popup titles and tooltips in MV%i", async manifestVersion => {
    const fixture = await createIntegrationFixture(ADNBN_TEST_ROOT, path.join(__dirname, "fixture"));

    try {
        const directory = await fixture.build({manifestVersion});
        const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
        const field = manifestVersion === 2 ? "browser_action" : "action";

        expect(manifest[field]).toMatchObject({default_popup: "popup.html", default_title: "__MSG_popup_account__"});

        for (const [file, title] of [
            ["popup.html", "Account document"],
            ["settings.popup.html", "Settings document"],
        ]) {
            expect(await readFile(path.join(directory, file), "utf8")).toContain(`<title>${title}</title>`);
        }

        const messages = JSON.parse(await readFile(path.join(directory, "_locales", "en", "messages.json"), "utf8"));

        expect(messages.popup_account.message).toBe("Open account");
    } finally {
        await fixture.dispose();
    }
});

test("builds an apply: false popup with a missing runtime translation without changing the initial tooltip", async () => {
    const fixture = await createIntegrationFixture(ADNBN_TEST_ROOT, path.join(__dirname, "fixture"));

    try {
        await copyFile(
            path.join(fixture.directory, "variants", "settings-missing-tooltip.ts"),
            path.join(fixture.directory, "src", "settings.popup.ts")
        );

        const directory = await fixture.build();
        const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
        const messages = JSON.parse(
            await readFile(path.join(directory, "_locales", manifest.default_locale, "messages.json"), "utf8")
        );

        expect(manifest.action).toMatchObject({default_popup: "popup.html", default_title: "__MSG_popup_account__"});
        expect(messages.popup_account.message).toBe("Open account");
        expect(messages).not.toHaveProperty("popup_missing");
    } finally {
        await fixture.dispose();
    }
});
