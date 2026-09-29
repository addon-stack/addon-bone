import {copyFile, readFile, stat} from "fs/promises";
import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";

const projectRoot = path.resolve(__dirname, "..", "..", "..", "..");
const fixtureDir = path.join(__dirname, "fixture");

jest.setTimeout(90_000);

describe.each([
    {browser: "chrome", manifestVersion: 3, actionField: "action"},
    {browser: "chrome", manifestVersion: 2, actionField: "browser_action"},
    {browser: "firefox", manifestVersion: 3, actionField: "action"},
    {browser: "firefox", manifestVersion: 2, actionField: "browser_action"},
] as const)("$browser MV$manifestVersion action", ({browser, manifestVersion, actionField}) => {
    test.each([
        {scenario: "config only", entry: undefined, popup: false, command: false, icon: "active", title: "action"},
        {
            scenario: "execute action",
            entry: "action.command.ts",
            popup: false,
            command: true,
            icon: "active",
            title: "action",
        },
        {
            scenario: "popup overrides",
            entry: "full.popup.ts",
            popup: true,
            command: false,
            icon: "popup",
            title: "popup",
        },
        {
            scenario: "popup title only",
            entry: "title.popup.ts",
            popup: true,
            command: false,
            icon: "active",
            title: "popup",
        },
        {
            scenario: "unapplied popup",
            entry: "unapplied.popup.ts",
            popup: false,
            command: false,
            icon: "active",
            title: "action",
        },
    ])("$scenario", async ({entry, popup, command, icon, title}) => {
        const fixture = await createIntegrationFixture(projectRoot, fixtureDir);

        try {
            if (entry) {
                const filename = command ? "action.command.ts" : "popup.ts";

                await copyFile(
                    path.join(fixture.directory, "variants", entry),
                    path.join(fixture.directory, "src", filename)
                );
            }

            const extensionDir = await fixture.build({browser, manifestVersion});
            const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
            const action = manifest[actionField];
            const messages = JSON.parse(
                await readFile(path.join(extensionDir, "_locales", "en", "messages.json"), "utf8")
            );

            expect(action).toEqual({
                default_icon: {16: `/icons/${icon}-16.png`},
                default_title: `__MSG_${title}_title__`,
                ...(popup ? {default_popup: "popup.html"} : {}),
            });
            expect(manifest.icons).toEqual({16: "/icons/16.png"});
            expect(messages.action_title.message).toBe("Run the action");
            expect(messages.popup_title.message).toBe("Open the popup");
            expect((await stat(path.join(extensionDir, "icons", `${icon}-16.png`))).isFile()).toBe(true);

            if (command) {
                expect(manifest.commands).toBeDefined();
                expect(manifest.background).toBeDefined();
            } else {
                expect(manifest.commands).toBeUndefined();
                expect(manifest.background).toBeUndefined();
            }
        } finally {
            await fixture.dispose();
        }
    });
});
