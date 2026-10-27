import {readdir, readFile, writeFile} from "fs/promises";
import path from "path";

import {createIntegrationFixture, type IntegrationFixture} from "../../utils/fixture";
import {readOverrideManifest} from "./override-utils";

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");

jest.setTimeout(90_000);

/** Adds the History entrypoint to a copy of the New Tab application, so two overrides compete. */
const createCompetingFixture = async (): Promise<IntegrationFixture> => {
    const fixture = await createIntegrationFixture(rootDir, path.join(__dirname, "newtab"));

    try {
        await writeFile(
            path.join(fixture.directory, "src", "history.ts"),
            await readFile(path.join(__dirname, "history", "src", "history.ts"))
        );
    } catch (error) {
        await fixture.dispose();

        throw error;
    }

    return fixture;
};

describe("competing overrides", () => {
    test.each(["chrome", "edge"])("%s build fails and names both entrypoints", async browser => {
        const fixture = await createCompetingFixture();

        try {
            const build = fixture.build({browser});

            await expect(build).rejects.toThrow(
                `An extension can override only one browser page, but app "addon" enables 2 override entrypoints for ${browser}:`
            );
            await expect(build).rejects.toThrow("  - newtab: src/newtab.ts");
            await expect(build).rejects.toThrow("  - history: src/history.ts");
        } finally {
            await fixture.dispose();
        }
    });

    test("firefox build keeps the new tab and its permission without the unsupported history page", async () => {
        const fixture = await createCompetingFixture();

        try {
            const extensionDir = await fixture.build({browser: "firefox"});
            const manifest = await readOverrideManifest(extensionDir);

            expect(manifest.chrome_url_overrides).toEqual({newtab: "newtab.html"});
            expect(manifest.permissions).toEqual(["search"]);
            expect(await readdir(extensionDir)).not.toContain("history.html");
        } finally {
            await fixture.dispose();
        }
    });
});
