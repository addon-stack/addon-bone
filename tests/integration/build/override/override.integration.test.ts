import {readdir, readFile, writeFile} from "fs/promises";
import path from "path";

import {createIntegrationFixture, type IntegrationFixture} from "../../utils/fixture";

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");

jest.setTimeout(90_000);

const readManifest = async (extensionDir: string) => {
    return JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
};

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

describe.each([
    {page: "newtab", permission: "search", supported: ["chrome", "edge", "firefox", "safari"], unsupported: ["opera"]},
    {
        page: "bookmarks",
        permission: "bookmarks",
        supported: ["chrome", "edge"],
        unsupported: ["firefox", "safari", "opera"],
    },
    {
        page: "history",
        permission: "history",
        supported: ["chrome", "edge"],
        unsupported: ["firefox", "safari", "opera"],
    },
])("$page override", ({page, permission, supported, unsupported}) => {
    const fixtureDir = path.join(__dirname, page);
    const source = `https://${page}.example.com`;

    describe.each(supported)("%s", browser => {
        test.each([2, 3] as const)("MV%s build replaces the browser page", async manifestVersion => {
            const fixture = await createIntegrationFixture(rootDir, fixtureDir);

            try {
                const extensionDir = await fixture.build({browser, manifestVersion});
                const manifest = await readManifest(extensionDir);
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
                const manifest = await readManifest(extensionDir);

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

describe("competing overrides", () => {
    test.each(["chrome", "edge"])("%s build fails and names both entrypoints", async browser => {
        const fixture = await createCompetingFixture();

        try {
            const build = fixture.build({browser});

            await expect(build).rejects.toThrow(
                `An extension can override only one browser page, but app "myapp" enables 2 override entrypoints for ${browser}:`
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
            const manifest = await readManifest(extensionDir);

            expect(manifest.chrome_url_overrides).toEqual({newtab: "newtab.html"});
            expect(manifest.permissions).toEqual(["search"]);
            expect(await readdir(extensionDir)).not.toContain("history.html");
        } finally {
            await fixture.dispose();
        }
    });
});
