import {readFile, writeFile} from "fs/promises";
import path from "path";

import {createIntegrationFixture} from "../../utils/fixture";

const rootDir = path.resolve(__dirname, "../../../..");
const fixtureDir = path.join(__dirname, "fixture");
const scenarios = path.join(__dirname, "scenarios");
const forms = ["object", "array", "function-object", "function-array"];

jest.setTimeout(90_000);

test.each(forms)("builds entrypoint metadata and %s config without leaking tags to other pages", async form => {
    const fixture = await createIntegrationFixture(rootDir, fixtureDir);

    try {
        await writeFile(
            path.join(fixture.directory, "adnbn.config.ts"),
            await readFile(path.join(scenarios, `config-${form}.ts`))
        );

        const browser = form.includes("array") ? "firefox" : "chrome";
        const output = await fixture.build({browser});
        const object = await readFile(path.join(output, "object.html"), "utf8");
        const array = await readFile(path.join(output, "array.html"), "utf8");

        expect(object).toMatch(/<meta(?=[^>]*name="entry-object")(?=[^>]*content="object")[^>]*>/);
        expect(object).toMatch(/<meta(?=[^>]*name="global-meta")(?=[^>]*content="global")[^>]*>/);
        expect(array).toMatch(/<meta(?=[^>]*name="entry-array")(?=[^>]*content="array")[^>]*>/);
        expect(array).toMatch(/<meta(?=[^>]*name="theme-color")(?=[^>]*content="#123456")[^>]*>/);
        expect(object).not.toContain("entry-array");
        expect(array).not.toMatch(/entry-object|global-meta|global.js|string.css|local.js/);

        for (const asset of [
            "string.css",
            "string.js",
            "tag.css",
            "tag.js",
            "custom.module",
            "styles/style.css",
            "local.js",
            "vendor.js",
        ]) {
            expect(object).toContain(`/${asset}?static`);
        }

        expect(object).toMatch(/src="\/global\/global.js\?build=[a-f0-9]+"/);

        for (const [emitted, original] of [
            ["local.js", "local.js"],
            ["global.js", "global.js"],
            ["styles/style.css", "style.css"],
        ]) {
            expect(await readFile(path.join(output, emitted), "utf8")).toBe(
                await readFile(path.join(fixture.directory, "assets", original), "utf8")
            );
        }
    } finally {
        await fixture.dispose();
    }
});

test("reports invalid metas returned by the html factory during a real build", async () => {
    const fixture = await createIntegrationFixture(rootDir, fixtureDir);

    try {
        await writeFile(
            path.join(fixture.directory, "adnbn.config.ts"),
            await readFile(path.join(scenarios, "config-function-array.ts"))
        );
        await writeFile(
            path.join(fixture.directory, "html-options.ts"),
            await readFile(path.join(scenarios, "options-mixed.ts"))
        );

        await expect(fixture.build()).rejects.toThrow(/metas.*object/);
    } finally {
        await fixture.dispose();
    }
});

test.each([
    ["invalid-metas", /Invalid options metas.*object\.page\.ts.*attributes/],
    ["conflicting-hash", /metas\.hash/],
])("rejects entrypoint %s during a real build", async (scenario, message) => {
    const fixture = await createIntegrationFixture(rootDir, fixtureDir);

    try {
        await writeFile(
            path.join(fixture.directory, "src", "object.page.ts"),
            await readFile(path.join(scenarios, `page-${scenario}.ts`))
        );

        await expect(fixture.build()).rejects.toThrow(message);
    } finally {
        await fixture.dispose();
    }
});
