import {spawnSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import path from "node:path";

import {createIntegrationFixture, type IntegrationFixture} from "../../utils/fixture";
import type {OptionalConfig} from "@typing/config";
import {Browser} from "@typing/browser";

const projectRoot = path.resolve(__dirname, "../../../..");
const resolver = path.join(projectRoot, "dist", "cli", "resolvers", "config.js");
const cli = path.join(projectRoot, "bin", "adnbn.js");

describe("user configuration through real c12", () => {
    let fixture: IntegrationFixture;

    beforeEach(async () => {
        fixture = await createIntegrationFixture(projectRoot, path.join(__dirname, "fixtures", "config"));
    });

    afterEach(async () => {
        await fixture.dispose();
    });

    const run = (args: string[]) => {
        const result = spawnSync(process.execPath, args, {
            cwd: fixture.directory,
            encoding: "utf8",
            timeout: 30_000,
            maxBuffer: 4 * 1024 * 1024,
        });

        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();

        return result;
    };

    const inspect = (options: OptionalConfig = {}, configFile = "adnbn.config.ts") => {
        return run([
            path.join(__dirname, "scripts", "inspect-config.mjs"),
            resolver,
            fixture.directory,
            configFile,
            JSON.stringify(options),
        ]);
    };

    const readJson = async (...parts: string[]) => {
        return JSON.parse(await readFile(path.join(fixture.directory, ...parts), "utf8"));
    };

    test.each([
        {browser: undefined, expectedBrowser: "chrome", name: "My Extension"},
        {browser: Browser.Firefox, expectedBrowser: "firefox", name: "My Extension for Firefox"},
    ])(
        "passes the initial $expectedBrowser config and merges the callback result",
        async ({browser, expectedBrowser, name}) => {
            const result = inspect({
                browser,
                name: "Launch name",
                version: "9.0.0",
                srcDir: "addon",
                plugins: [{name: "option-plugin"}],
            });

            expect({status: result.status, stderr: result.stderr}).toEqual({status: 0, stderr: ""});

            const initial = await readJson("callback-input.json");

            expect(initial).toMatchObject({
                rootDir: fixture.directory,
                configFile: "adnbn.config.ts",
                browser: expectedBrowser,
                name: "Launch name",
                version: "9.0.0",
                command: "build",
                mode: "development",
                app: "myapp",
                manifestVersion: 3,
                lang: "en",
                workspace: "single",
                sharedDir: "shared",
                srcDir: "addon",
                outDir: "dist",
                mergeStyles: true,
                plugins: ["option-plugin"],
            });

            const baseline = inspect({}, "object.config.ts");

            expect({status: baseline.status, stderr: baseline.stderr}).toEqual({status: 0, stderr: ""});
            expect(JSON.parse(result.stdout)).toEqual({
                ...initial,
                name,
                version: "1.2.3",
                lang: "fr",
                sharedDir: ".",
                plugins: ["option-plugin", "config-fixture", ...JSON.parse(baseline.stdout).plugins],
            });
        }
    );

    test.each([
        {configFile: "object.config.ts", name: "Object configuration"},
        {configFile: "no-argument.config.ts", name: "Callback without an argument"},
    ])("continues to load $configFile", ({configFile, name}) => {
        const result = inspect({browser: Browser.Firefox}, configFile);

        expect({status: result.status, stderr: result.stderr}).toEqual({status: 0, stderr: ""});
        expect(JSON.parse(result.stdout)).toMatchObject({browser: "firefox", name, version: "1.2.3", srcDir: "src"});
    });

    test("validates the returned callback settings", () => {
        const result = inspect({}, "invalid.config.ts");

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
            "Source directory (srcDir) and destination directory (outputDir) cannot be the same."
        );
    });

    test("build --browser firefox emits the callback name and runs its user plugin", async () => {
        const result = run([cli, "build", ".", "--browser", "firefox"]);

        expect({status: result.status, stderr: result.stderr}).toEqual({status: 0, stderr: ""});
        expect(await readJson("callback-input.json")).toMatchObject({
            browser: "firefox",
            command: "build",
            mode: "production",
            name: "myapp",
            manifestVersion: 3,
        });
        expect(await readJson("dist", "myapp-firefox-mv3", "manifest.json")).toMatchObject({
            name: "My Extension for Firefox",
            version: "1.2.3",
            manifest_version: 3,
        });
        expect(await readJson("user-plugin.json")).toEqual({name: "My Extension for Firefox", browser: "firefox"});
    });
});
