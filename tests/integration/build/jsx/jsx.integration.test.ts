import {readFile} from "fs/promises";
import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";

const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
const fixtureDir = path.join(__dirname, "fixture");

jest.setTimeout(90_000);

test.each(["chrome", "firefox"])("%s builds JSX pages and preserves their AST options", async browser => {
    const fixture = await createIntegrationFixture(rootDir, fixtureDir);

    try {
        const extensionDir = await fixture.build({browser});
        const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));

        expect(manifest.manifest_version).toBe(3);
        expect(manifest.web_accessible_resources).toEqual([
            {resources: ["definition.html"], matches: ["https://example.com/*"]},
        ]);

        const declarations = await readFile(path.join(fixture.directory, ".adnbn", "page.d.ts"), "utf8");

        for (const alias of ["jsx-definition", "jsx-named", "jsx-element"]) {
            expect(declarations).toContain(`"${alias}": true;`);
        }

        for (const [name, title] of [
            ["definition", "JSX definition"],
            ["named", "JSX named"],
            ["element", "JSX element"],
            ["javascript", "JavaScript page"],
            ["typescript", "TypeScript page"],
            ["react-typescript", "TSX page"],
        ]) {
            const html = await readFile(path.join(extensionDir, `${name}.html`), "utf8");

            expect(html).toContain(`<title>${title}</title>`);
            expect(html).toContain("<script");
        }
    } finally {
        await fixture.dispose();
    }
});
