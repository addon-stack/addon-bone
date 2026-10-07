import {readFile} from "fs/promises";
import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtureDir = path.join(__dirname, "fixture");

jest.setTimeout(90_000);

test.each([
    {browser: "chrome", manifestVersion: 2 as const},
    {browser: "chrome", manifestVersion: 3 as const},
    {browser: "firefox", manifestVersion: 3 as const},
])("builds persistent false for $browser MV$manifestVersion", async ({browser, manifestVersion}) => {
    const fixture = await createIntegrationFixture(rootDir, fixtureDir);

    try {
        const extensionDir = await fixture.build({browser, manifestVersion});
        const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));

        expect(manifest.manifest_version).toBe(manifestVersion);
        expect(manifest.background).toEqual(
            manifestVersion === 2
                ? {scripts: [expect.stringMatching(/\.js$/)], persistent: false}
                : browser === "firefox"
                  ? {scripts: [expect.stringMatching(/\.js$/)]}
                  : {service_worker: expect.stringMatching(/\.js$/)}
        );

        if (manifestVersion === 3) {
            expect(manifest.background).not.toHaveProperty("persistent");
        }

        const script = manifest.background.service_worker ?? manifest.background.scripts[0];

        expect(await readFile(path.join(extensionDir, script), "utf8")).not.toBe("");
    } finally {
        await fixture.dispose();
    }
});
