import {readFile, readdir} from "node:fs/promises";
import path from "node:path";

import {createIntegrationFixture} from "../../utils/fixture";

const root = path.resolve(import.meta.dirname, "../../../..");
const source = path.join(import.meta.dirname, "fixtures", "project-roots");

test("resolves root-relative CSS and SCSS URLs from the consumer project through the full style pipeline", async () => {
    const fixture = await createIntegrationFixture(root, source);

    try {
        const output = await fixture.build();
        const files = await readdir(path.join(output, "assets"));

        expect(files.sort()).toEqual(["css.svg", "scss.svg"]);

        for (const file of files) {
            expect(await readFile(path.join(output, "assets", file), "utf8")).toBe(
                await readFile(path.join(source, file), "utf8")
            );
        }

        const css = await readFile(path.join(output, "css", "probe.page.css"), "utf8");
        expect(css).toContain("assets/css.svg");
        expect(css).toContain("assets/scss.svg");
    } finally {
        await fixture.dispose();
    }
});
