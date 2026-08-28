/** @jest-environment node */

import {spawnSync} from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

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

    const run = (command: "build" | "watch", fixture: string) => {
        fs.cpSync(path.join(fixtures, fixture), root, {recursive: true});

        const result = spawnSync(process.execPath, [cli, command, root, "-a", "exit-code", "-b", "chrome"], {
            cwd: root,
            encoding: "utf8",
            timeout: 30_000,
            maxBuffer: 4 * 1024 * 1024,
        });

        if (result.error) {
            throw result.error;
        }

        expect(result.signal).toBeNull();

        return {status: result.status, output: `${result.stdout}\n${result.stderr}`};
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
});
