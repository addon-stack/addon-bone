/** @jest-environment node */

import {spawnSync} from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import {stripVTControlCharacters} from "util";

const cli = path.resolve(__dirname, "../../bin/adnbn.js");
const fixtures = path.join(__dirname, "tests/fixtures/exit-code");

describe("CLI exit codes", () => {
    let root: string;
    let artifact: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), "adnbn-cli-exit-code-"));
        artifact = path.join(root, "dist/exit-code-chrome-mv3");
    });

    afterEach(() => {
        fs.rmSync(root, {recursive: true, force: true});
    });

    const run = (command: "build" | "watch", fixture: string, failure?: string) => {
        fs.cpSync(path.join(fixtures, fixture), root, {recursive: true});

        const result = spawnSync(process.execPath, [cli, command, root, "-a", "exit-code", "-b", "chrome"], {
            cwd: root,
            encoding: "utf8",
            timeout: 30_000,
            maxBuffer: 4 * 1024 * 1024,
            env: {...process.env, ADNBN_TEST_BUILD_FAILURE: failure ?? ""},
        });

        if (result.error) {
            throw result.error;
        }

        expect(result.signal).toBeNull();

        return {status: result.status, output: stripVTControlCharacters(`${result.stdout}\n${result.stderr}`)};
    };

    test("build exits with 0 and emits an extension on success", () => {
        const result = run("build", "success");

        expect(result.status).toBe(0);
        expect(JSON.parse(fs.readFileSync(path.join(artifact, "manifest.json"), "utf8"))).toMatchObject({
            manifest_version: 3,
            version: "1.0.0",
            default_locale: "en",
        });
        expect(JSON.parse(fs.readFileSync(path.join(artifact, "_locales/fr/messages.json"), "utf8"))).toMatchObject({
            cart_items: {message: "article|articles"},
            locale: {message: "fr"},
        });
    });

    test.each(["build", "watch"] as const)("%s exits with 1 when a plural key is missing at startup", command => {
        const result = run(command, "missing-plural");

        expect(result.output).toContain(
            'Locale "fr" is missing plural key "cart.items" required by default locale "en"'
        );
        expect(result.status).toBe(1);
        expect(fs.existsSync(path.join(artifact, "manifest.json"))).toBe(false);
    });

    test.each(["build", "watch"] as const)("%s exits with 1 when configuration is invalid", command => {
        const result = run(command, "invalid-config");

        expect(result.output).toContain('Invalid language "unsupported" provided by config');
        expect(result.status).toBe(1);
        expect(fs.existsSync(path.join(artifact, "manifest.json"))).toBe(false);
    });

    test("prints successful build statistics only after compiler shutdown", () => {
        const result = run("build", "lifecycle");

        expect(result.status).toBe(0);
        expect(fs.readFileSync(path.join(artifact, "compiler-closed.txt"), "utf8")).toBe("closed");
        expect(result.output).toContain("Lifecycle fixture shutdown finished");
        expect(result.output).toContain("compiled successfully");
        expect(result.output.indexOf("Lifecycle fixture shutdown finished")).toBeLessThan(
            result.output.indexOf("compiled successfully")
        );
    });

    test.each([
        {failure: "compilation", messages: ["Lifecycle fixture compilation failure"]},
        {failure: "run", messages: ["Lifecycle fixture run failure"]},
        {failure: "close", messages: ["Lifecycle fixture close failure"]},
        {failure: "both", messages: ["Lifecycle fixture run failure", "Lifecycle fixture close failure"]},
    ])("build exits with 1 after shutdown for $failure failure", ({failure, messages}) => {
        const result = run("build", "lifecycle", failure);

        expect(result.status).toBe(1);
        expect(fs.readFileSync(path.join(artifact, "compiler-closed.txt"), "utf8")).toBe("closed");

        for (const message of messages) {
            expect(result.output).toContain(message);
        }
    });

    test("the internal app build returns Stats after shutdown without printing them", () => {
        fs.cpSync(path.join(fixtures, "lifecycle"), root, {recursive: true});
        const result = spawnSync(
            process.execPath,
            [
                path.join(__dirname, "tests/fixtures/build-api.mjs"),
                path.resolve(__dirname, "../../dist/cli/builders/app/index.js"),
                root,
                artifact,
            ],
            {
                cwd: root,
                encoding: "utf8",
                timeout: 30_000,
                env: {...process.env, ADNBN_TEST_BUILD_FAILURE: ""},
            }
        );

        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Build API resolved after shutdown");
        expect(stripVTControlCharacters(result.stdout)).not.toContain("compiled successfully");
    });
});
