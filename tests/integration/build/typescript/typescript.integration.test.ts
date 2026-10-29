import {readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import {createIntegrationFixture} from "../../utils/fixture";
import {run} from "../../utils/process";

const root = path.resolve(import.meta.dirname, "../../../..");
const source = path.join(import.meta.dirname, "fixture");

test("builds verified type re-exports alongside values in production and development", async () => {
    const fixture = await createIntegrationFixture(root, source);

    try {
        const output = await fixture.build();
        const script = path.join(output, "js", "probe.page.js");

        expect(await readFile(script, "utf8")).toContain("type-reexports-value");

        await run(
            process.execPath,
            [path.join(root, "bin/adnbn.js"), "build", ".", "--mode", "development"],
            fixture.directory
        );

        expect(await readFile(script, "utf8")).toContain("type-reexports-value");
    } finally {
        await fixture.dispose();
    }
});

test.each(["missing-type", "missing-value"])("rejects a genuinely absent export (%s)", async scenario => {
    const fixture = await createIntegrationFixture(root, source);

    try {
        await writeFile(
            path.join(fixture.directory, "src", "barrel.ts"),
            await readFile(path.join(import.meta.dirname, "states", `${scenario}.ts`))
        );

        await expect(fixture.build()).rejects.toThrow(/export 'Missing'.*not found/);
    } finally {
        await fixture.dispose();
    }
});

test("requires export type for type-only re-exports from a package with JavaScript and declarations", async () => {
    const fixture = await createIntegrationFixture(root, source);

    try {
        await writeFile(
            path.join(fixture.directory, "src", "barrel.ts"),
            await readFile(path.join(import.meta.dirname, "states", "package-implicit.ts"))
        );

        await expect(fixture.build()).rejects.toThrow(/export 'UserConfig'.*not found/);

        await writeFile(
            path.join(fixture.directory, "src", "barrel.ts"),
            await readFile(path.join(import.meta.dirname, "states", "package-explicit.ts"))
        );

        const output = await fixture.build();

        expect(await readFile(path.join(output, "js", "probe.page.js"), "utf8")).toContain("type-reexports-value");
    } finally {
        await fixture.dispose();
    }
});

test("does not load the unsupported .swcrc configuration", async () => {
    const fixture = await createIntegrationFixture(root, source);

    try {
        await writeFile(
            path.join(fixture.directory, ".swcrc"),
            await readFile(path.join(import.meta.dirname, "states", "unsupported.swcrc"))
        );

        await expect(fixture.build()).resolves.toBe(path.join(fixture.directory, "dist", "addon-chrome-mv3"));
    } finally {
        await fixture.dispose();
    }
});
