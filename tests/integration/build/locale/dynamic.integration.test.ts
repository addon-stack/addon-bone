/** @jest-environment node */

import {copyFile, readFile, readdir, rm} from "fs/promises";
import path from "path";
import vm from "vm";
import {createIntegrationFixture} from "../../utils/fixture";
import {run} from "../../utils/process";

jest.setTimeout(90_000);

const fixtureDirectory = path.join(__dirname, "dynamic-fixture");

test("the published package imports without bundler aliases or extension APIs", async () => {
    await run(process.execPath, [path.join(__dirname, "states/package-import.mjs")], ADNBN_TEST_ROOT);
});

test.each(["chrome", "firefox"])(
    "%s bundles DynamicLocale through the public package and preserves declarations",
    async browser => {
        const fixture = await createIntegrationFixture(ADNBN_TEST_ROOT, fixtureDirectory);
        try {
            const directory = await fixture.build({browser});
            const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
            const background = manifest.background.service_worker ?? manifest.background.scripts[0];
            const catalogue = await readFile(path.join(directory, "js/locale.js"), "utf8");
            expect(catalogue).toContain("Bonjour depuis DynamicLocale");
            expect(catalogue).toContain("Completed from English");
            expect(await readFile(path.join(directory, background), "utf8")).toContain("Bonjour depuis DynamicLocale");
            expect(manifest.content_scripts.find((entry: {world: string}) => entry.world === "ISOLATED").js).toContain(
                "js/locale.js"
            );
            expect(manifest.web_accessible_resources).toBeUndefined();
            for (const filename of [manifest.action.default_popup, manifest.options_ui.page]) {
                expect(await readFile(path.join(directory, filename), "utf8")).toContain("js/locale.js");
            }
            await run(
                process.execPath,
                [path.join(ADNBN_TEST_ROOT, "node_modules/typescript/bin/tsc"), "--noEmit", "-p", "tsconfig.json"],
                fixture.directory
            );
            await run(
                process.execPath,
                [path.join(ADNBN_TEST_ROOT, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.locale.json"],
                fixture.directory
            );
            const declaration = await readFile(
                path.join(ADNBN_TEST_ROOT, "dist/locale/providers/DynamicLocale.d.ts"),
                "utf8"
            );
            expect(declaration).not.toContain("#adnbn/locale");
            expect(declaration).toContain("extends AbstractLocale<T>");
        } finally {
            await fixture.dispose();
        }
    }
);

test("native-only consumers do not include the catalogue despite importing the public barrel", async () => {
    const fixture = await createIntegrationFixture(ADNBN_TEST_ROOT, fixtureDirectory);
    try {
        for (const file of ["popup.ts", "options.ts", "locale.content.ts", "main.content.ts"])
            await rm(path.join(fixture.directory, "src", file));
        await copyFile(
            path.join(__dirname, "states/native-background.ts"),
            path.join(fixture.directory, "src/background.ts")
        );
        const directory = await fixture.build();
        const files = (await readdir(path.join(directory, "js"))).filter(file => file.endsWith(".js"));
        expect(files).toHaveLength(1);
        expect(files[0]).toBe("background.js");
        const source = await readFile(path.join(directory, "js/background.js"), "utf8");
        expect(source).not.toContain("Hello from DynamicLocale!");
        expect(source).not.toContain("Bonjour depuis DynamicLocale");
        const sandbox = {
            chrome: {i18n: {getMessage: (key: string) => (key === "locale" ? "en" : "")}},
            nativeLocale: undefined as
                | {
                      keys(): Set<string>;
                      languages(): Set<string>;
                      languageNames(): Map<string, string>;
                      trans(key: string): string;
                  }
                | undefined,
        };
        vm.runInNewContext(source, sandbox);
        expect([...sandbox.nativeLocale!.keys()].sort()).toEqual([
            "app.title",
            "empty",
            "fallback",
            "greeting",
            "items",
            "locale",
            "welcome",
        ]);
        expect(sandbox.nativeLocale!.trans("empty")).toBe("");
        expect([...sandbox.nativeLocale!.languages()]).toEqual(["en", "fr"]);
        expect([...sandbox.nativeLocale!.languageNames()]).toEqual([
            ["en", "English"],
            ["fr", "Français"],
        ]);
    } finally {
        await fixture.dispose();
    }
});
