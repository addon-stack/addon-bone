/** @jest-environment node */

import {readFile} from "fs/promises";
import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
const fixtureDir = path.join(__dirname, "embedded");

jest.setTimeout(90_000);

describe.each(["chrome", "edge", "opera", "safari", "firefox"])("%s options manifest", browser => {
    test.each([2, 3] as const)("MV%s build preserves explicit openInTab false", async manifestVersion => {
        const fixture = await createIntegrationFixture(rootDir, fixtureDir);

        try {
            const extensionDir = await fixture.build({browser, manifestVersion});
            const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));

            expect(manifest.manifest_version).toBe(manifestVersion);
            expect(manifest.options_ui).toEqual({page: "options.html", open_in_tab: false});
            expect(manifest.options_page).toBeUndefined();
            expect(await readFile(path.join(extensionDir, manifest.options_ui.page), "utf8")).toContain("<script");
        } finally {
            await fixture.dispose();
        }
    });
});
