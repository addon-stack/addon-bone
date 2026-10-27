import {readFile, readdir} from "fs/promises";
import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
const fixtureDir = path.join(__dirname, "fixture");

jest.setTimeout(90_000);

describe("workspace page discovery", () => {
    test("builds directory pages with adjacent templates, styles, components and entrypoint-named imports", async () => {
        const fixture = await createIntegrationFixture(rootDir, fixtureDir);

        try {
            const extensionDir = await fixture.build();
            const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));

            expect(manifest.options_ui).toEqual({page: "options.html", open_in_tab: true});
            expect(manifest.chrome_url_overrides).toEqual({newtab: "newtab.html"});

            for (const type of ["options", "newtab"]) {
                const html = await readFile(path.join(extensionDir, `${type}.html`), "utf8");

                expect(html).toContain(`data-template="${type}"`);
                expect(html).toContain("<script");
                expect(html).toContain(".css");
            }

            const files = await readdir(extensionDir, {recursive: true});
            const readAssets = async (extension: string): Promise<string> => {
                const contents = await Promise.all(
                    files
                        .filter(file => file.endsWith(extension))
                        .map(file => readFile(path.join(extensionDir, file), "utf8"))
                );

                return contents.join("\n");
            };

            const scripts = await readAssets(".js");
            const styles = await readAssets(".css");

            expect(scripts).toContain("Imported account component");
            expect(scripts).toContain("Imported options module");
            expect(scripts).toContain("Imported newtabs module");
            expect(styles).toContain(".settings-form");
            expect(styles).toContain(".newtab-page");
            expect(files.some(file => file.endsWith(".svg"))).toBe(true);
            expect(files.filter(file => file.endsWith(".html")).sort()).toEqual(["newtab.html", "options.html"]);
        } finally {
            await fixture.dispose();
        }
    });
});
