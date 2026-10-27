import {readdir, readFile, writeFile} from "fs/promises";
import path from "path";

import BuildSession from "../../utils/BuildSession";

import {createIntegrationFixture} from "../../utils/fixture";

interface OverridePageScenario {
    page: string;
    permission: string;
    supported: readonly string[];
    unsupported: readonly string[];
}

const buildMode = process.env.ADNBN_OVERRIDE_BUILD_MODE ?? "cli";

if (buildMode !== "cli" && buildMode !== "session") {
    throw new Error(`Unknown override build mode: ${buildMode}`);
}

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");

export const readOverrideManifest = async (extensionDir: string) => {
    return JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
};

export const testOverridePage = ({page, permission, supported, unsupported}: OverridePageScenario): void => {
    describe(`${page} override`, () => {
        const fixtureDir = path.join(__dirname, page);
        const source = `https://${page}.example.com`;
        let session: BuildSession | undefined;

        beforeAll(async () => {
            if (buildMode === "session") {
                session = await BuildSession.create(rootDir);
            }
        });

        afterAll(async () => {
            await session?.dispose();
        });

        describe.each(supported)("%s", browser => {
            test.each([2, 3] as const)("MV%s build replaces the browser page", async manifestVersion => {
                const fixture = await createIntegrationFixture(rootDir, fixtureDir, session);

                try {
                    await writeFile(
                        path.join(fixture.directory, "manifest-version.json"),
                        JSON.stringify({mv2: manifestVersion === 2})
                    );

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
                const fixture = await createIntegrationFixture(rootDir, fixtureDir, session);

                try {
                    await writeFile(
                        path.join(fixture.directory, "manifest-version.json"),
                        JSON.stringify({mv2: manifestVersion === 2})
                    );

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
