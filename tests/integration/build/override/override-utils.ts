import {readdir, readFile} from "fs/promises";
import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";

interface OverridePageScenario {
    page: string;
    permission: string;
    supported: readonly string[];
    unsupported: readonly string[];
}

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");

export const readOverrideManifest = async (extensionDir: string) => {
    return JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
};

export const testOverridePage = ({page, permission, supported, unsupported}: OverridePageScenario): void => {
    describe(`${page} override`, () => {
        const fixtureDir = path.join(__dirname, page);
        const source = `https://${page}.example.com`;

        describe.each(supported)("%s", browser => {
            test.each([2, 3] as const)("MV%s build replaces the browser page", async manifestVersion => {
                const fixture = await createIntegrationFixture(rootDir, fixtureDir);

                try {
                    const extensionDir = await fixture.build({browser, manifestVersion});
                    const manifest = await readOverrideManifest(extensionDir);
                    const html = await readFile(path.join(extensionDir, `${page}.html`), "utf8");

                    expect(manifest.manifest_version).toBe(manifestVersion);
                    expect(manifest.chrome_url_overrides).toEqual({[page]: `${page}.html`});
                    expect(JSON.stringify(manifest.content_security_policy)).toContain(source);
                    expect(manifest.permissions).toContain(permission);
                    expect(html).toContain("<title>Custom");
                    expect(html).toContain("<script");
                } finally {
                    await fixture.dispose();
                }
            });
        });

        describe.each(unsupported)("%s", browser => {
            test.each([2, 3] as const)("MV%s build skips the unsupported page", async manifestVersion => {
                const fixture = await createIntegrationFixture(rootDir, fixtureDir);

                try {
                    const extensionDir = await fixture.build({browser, manifestVersion});
                    const manifest = await readOverrideManifest(extensionDir);

                    expect(manifest.manifest_version).toBe(manifestVersion);
                    expect(manifest).not.toHaveProperty("chrome_url_overrides");
                    expect(JSON.stringify(manifest)).not.toContain(source);
                    expect(manifest.permissions ?? []).not.toContain(permission);
                    expect(await readdir(extensionDir)).not.toContain(`${page}.html`);
                } finally {
                    await fixture.dispose();
                }
            });
        });
    });
};
