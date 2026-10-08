import {spawnSync} from "node:child_process";
import {readFile, readdir, rm} from "node:fs/promises";
import path from "node:path";

import {createIntegrationFixture, type IntegrationFixture} from "../../utils/fixture";
import type {OptionalConfig} from "@typing/config";
import {Browser} from "@typing/browser";
import {Mode} from "@typing/app";

const projectRoot = path.resolve(__dirname, "../../../..");
const resolver = path.join(projectRoot, "dist", "cli", "resolvers", "config.js");
const cli = path.join(projectRoot, "bin", "adnbn.js");

const productionDefaults: OptionalConfig = {
    name: "addon",
    manifestVersion: 3,
    assetsFilename: "[contenthash:4][ext]",
    jsFilename: "[contenthash:5].js",
    cssFilename: "[contenthash:5].css",
    cssIdentName: "[app]-[hash:base64:5]",
};

const updatedDefaults = {
    name: "reader",
    manifestVersion: 2,
    assetsFilename: "[name]-[contenthash:4][ext]",
    jsFilename: "[name].js",
    cssFilename: "[name].css",
    cssIdentName: "[local]-[hash:base64:5]",
};

describe("user configuration through real c12", () => {
    let fixture: IntegrationFixture;

    beforeEach(async () => {
        fixture = await createIntegrationFixture(projectRoot, path.join(__dirname, "fixtures", "config"));
    });

    afterEach(async () => {
        await fixture.dispose();
    });

    const run = (args: string[], env = process.env) => {
        const result = spawnSync(process.execPath, args, {
            cwd: fixture.directory,
            env,
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
                app: "addon",
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
            name: "addon",
            manifestVersion: 3,
        });
        expect(await readJson("dist", "addon-firefox-mv3", "manifest.json")).toMatchObject({
            name: "My Extension for Firefox",
            version: "1.2.3",
            manifest_version: 3,
        });
        expect(await readJson("user-plugin.json")).toEqual({name: "My Extension for Firefox", browser: "firefox"});
    });

    test("CLI build preserves manifest callback fields after reading web accessible resources", async () => {
        const result = run([cli, "build", ".", "--config", "manifest-callback.config.ts"]);

        expect({status: result.status, stderr: result.stderr}).toEqual({status: 0, stderr: ""});
        expect(await readJson("dist", "addon-chrome-mv3", "manifest.json")).toMatchObject({
            manifest_version: 3,
            version: "1.2.3",
            version_name: "1.2 beta",
        });
    });

    test("object and callback settings recalculate the same defaults after one callback invocation", async () => {
        const configs = ["object", "callback"].map(kind => {
            const result = inspect({mode: Mode.Production}, path.join("defaults", `${kind}.config.ts`));

            expect({status: result.status, stderr: result.stderr}).toEqual({status: 0, stderr: ""});

            return JSON.parse(result.stdout);
        });

        expect(configs[0]).toMatchObject({
            ...updatedDefaults,
            app: "reader",
            browser: "safari",
            mode: "development",
        });
        expect(configs[1]).toEqual({...configs[0], configFile: path.join("defaults", "callback.config.ts")});

        const calls = (await readFile(path.join(fixture.directory, "callback-calls.jsonl"), "utf8"))
            .trim()
            .split("\n")
            .map(line => JSON.parse(line));

        expect(calls).toEqual([
            expect.objectContaining({
                ...productionDefaults,
                app: "addon",
                browser: "chrome",
                mode: "production",
                sharedDir: "shared",
                plugins: [],
            }),
        ]);
    });

    test("undefined fields discarded by c12 keep automatic defaults eligible for recalculation", () => {
        const result = inspect({mode: Mode.Production}, path.join("defaults", "undefined.config.ts"));

        expect({status: result.status, stderr: result.stderr}).toEqual({status: 0, stderr: ""});
        expect(JSON.parse(result.stdout)).toMatchObject(updatedDefaults);
    });

    test("defaults explicitly returned by a callback remain overrides", () => {
        const result = inspect({mode: Mode.Production}, path.join("defaults", "explicit-callback.config.ts"));

        expect({status: result.status, stderr: result.stderr}).toEqual({status: 0, stderr: ""});
        expect(JSON.parse(result.stdout)).toMatchObject({
            ...productionDefaults,
            app: "reader",
            browser: "safari",
            mode: "development",
        });
    });

    test.each([
        {kind: "object", app: "reader", browser: "safari", name: "reader", readable: true, manifestVersion: 2},
        {kind: "debug", app: "reader", browser: "chrome", name: "reader", readable: true, manifestVersion: 3},
        {kind: "explicit", app: "reader", browser: "safari", name: "addon", readable: false, manifestVersion: 3},
        {kind: "production", app: "addon", browser: "chrome", name: "addon", readable: false, manifestVersion: 3},
    ])(
        "CLI build emits the $kind manifest and filename defaults",
        async ({kind, app, browser, name, readable, manifestVersion}) => {
            const result = run([
                cli,
                "build",
                ".",
                "--config",
                path.join("defaults", `${kind}.config.ts`),
                ...(kind === "explicit" ? ["--mv2"] : []),
            ]);

            expect(result.status).toBe(0);

            if (kind !== "debug") {
                expect(result.stderr).toBe("");
            }

            const output = path.join(fixture.directory, "dist", `${app}-${browser}-mv${manifestVersion}`);
            const manifest = JSON.parse(await readFile(path.join(output, "manifest.json"), "utf8"));
            const js = await readdir(path.join(output, "js"));
            const css = await readdir(path.join(output, "css"));
            const assets = await readdir(path.join(output, "assets"));

            expect(manifest).toMatchObject({name, version: "1.2.3", manifest_version: manifestVersion});
            expect(js).toEqual([readable ? "probe.page.js" : expect.stringMatching(/^[a-f0-9]{5}\.js$/)]);
            expect(css).toEqual([readable ? "probe.page.css" : expect.stringMatching(/^[a-f0-9]{5}\.css$/)]);
            expect(assets).toEqual([
                expect.stringMatching(readable ? /^marker-[a-f0-9]{4}\.svg$/ : /^[a-f0-9]{4}\.svg$/),
            ]);
            expect(await readFile(path.join(output, "css", css[0]), "utf8")).toContain(`.${readable ? "probe" : app}-`);
        }
    );

    test.each([
        {browser: "safari", mv2: false, manifestVersion: 2},
        {browser: "chrome", mv2: false, manifestVersion: 3},
        {browser: "chrome", mv2: true, manifestVersion: 2},
    ])(
        "CLI build without a config targets $browser MV$manifestVersion (mv2 flag: $mv2)",
        async ({browser, mv2, manifestVersion}) => {
            await rm(path.join(fixture.directory, "adnbn.config.ts"));

            const result = run([cli, "build", ".", "-b", browser, ...(mv2 ? ["--mv2"] : [])], {
                ...process.env,
                VERSION: "1.2.3",
            });

            expect({status: result.status, stderr: result.stderr}).toEqual({status: 0, stderr: ""});
            expect(await readJson("dist", `addon-${browser}-mv${manifestVersion}`, "manifest.json")).toMatchObject({
                name: "addon",
                version: "1.2.3",
                manifest_version: manifestVersion,
            });
        }
    );
});
