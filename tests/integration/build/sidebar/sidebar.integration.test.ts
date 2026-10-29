import {jest} from "@jest/globals";

import {copyFile, readFile, stat} from "fs/promises";
import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";

jest.setTimeout(90_000);

test.each([
    {browser: "chrome", manifestVersion: 3},
    {browser: "firefox", manifestVersion: 2},
    {browser: "firefox", manifestVersion: 3},
    {browser: "opera", manifestVersion: 2},
    {browser: "opera", manifestVersion: 3},
] as const)("builds independent sidebar documents and labels for $browser MV$manifestVersion", async options => {
    const fixture = await createIntegrationFixture(ADNBN_TEST_ROOT, path.join(import.meta.dirname, "fixture"));

    try {
        const directory = await fixture.build(options);
        const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));

        if (options.browser === "chrome") {
            expect(manifest.side_panel).toEqual({default_path: "sidebar.html"});
            expect(manifest).not.toHaveProperty("sidebar_action");
        } else {
            expect(manifest.sidebar_action).toEqual({
                default_panel: "sidebar.html",
                default_title: "__MSG_sidebar_account__",
                default_icon: {16: "/icons/account-16.png"},
                ...(options.browser === "firefox" ? {open_at_install: false} : {}),
            });
            expect(manifest).not.toHaveProperty("side_panel");
        }

        expect(manifest[options.manifestVersion === 2 ? "browser_action" : "action"].default_title).toBe(
            "Independent toolbar"
        );

        for (const [file, title] of [
            ["sidebar.html", "Account document"],
            ["settings.sidebar.html", "Settings document"],
            ["empty.sidebar.html", "Addon"],
        ]) {
            expect(await readFile(path.join(directory, file), "utf8")).toContain(`<title>${title}</title>`);
        }

        const messages = JSON.parse(await readFile(path.join(directory, "_locales", "en", "messages.json"), "utf8"));

        expect(messages.sidebar_account.message).toBe("Open account");

        for (const icon of ["account", "settings"]) {
            expect((await stat(path.join(directory, "icons", `${icon}-16.png`))).isFile()).toBe(true);
        }
    } finally {
        await fixture.dispose();
    }
});

test.each([
    {variant: "without-label", expected: "Sidebar contract test"},
    {variant: "empty-label", expected: ""},
])("keeps document titles out of the initial UI label: $variant", async ({variant, expected}) => {
    const fixture = await createIntegrationFixture(ADNBN_TEST_ROOT, path.join(import.meta.dirname, "fixture"));

    try {
        await copyFile(
            path.join(fixture.directory, "variants", `sidebar-${variant}.ts`),
            path.join(fixture.directory, "src", "sidebar.ts")
        );

        const directory = await fixture.build({browser: "firefox", manifestVersion: 3});
        const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));

        expect(manifest.sidebar_action.default_title).toBe(expected);
        expect(await readFile(path.join(directory, "sidebar.html"), "utf8")).toContain(
            "<title>Only the document</title>"
        );
    } finally {
        await fixture.dispose();
    }
});
