import {readFile} from "fs/promises";
import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";

const projectRoot = path.resolve(__dirname, "../../../..");
const fixtureDir = path.join(__dirname, "fixture");

jest.setTimeout(90_000);

test.each(["chrome", "firefox"])("builds filtered shortcuts for %s and preserves manifest options", async browser => {
    const fixture = await createIntegrationFixture(projectRoot, fixtureDir);

    try {
        const extensionDir = await fixture.build({browser});
        const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));

        expect(manifest.commands).toEqual({
            "save-page": {
                description: "Save the page",
                global: false,
                suggested_key: {
                    default: "Ctrl+Shift+Y",
                    windows: "Alt+Shift+U",
                    mac: "Command+MacCtrl+Y",
                    chromeos: "Search+Shift+Y",
                    linux: "Ctrl+Shift+L",
                },
            },
            global: {
                description: "Global shortcut",
                global: true,
                suggested_key: {default: "Ctrl+Shift+5", mac: "Command+Shift+5"},
            },
            ...(browser === "firefox"
                ? {
                      firefox: {
                          description: "Firefox shortcut",
                          suggested_key: {
                              default: "Ctrl+Alt+Y",
                              mac: "Command+Alt+Y",
                              linux: "F12",
                              chromeos: "Search+Ctrl+Shift+Y",
                          },
                      },
                  }
                : {}),
        });
    } finally {
        await fixture.dispose();
    }
});
