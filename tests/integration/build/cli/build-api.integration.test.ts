import {spawnSync} from "node:child_process";
import {cpSync, mkdtempSync, rmSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {stripVTControlCharacters} from "node:util";

const scripts = path.join(__dirname, "scripts");
const appModule = path.resolve(__dirname, "../../../../dist/cli/builders/app/index.js");

test.each([
    "sequence",
    "sequence-mts",
    "sequence-cts",
    "unsupported-js",
    "unsupported-mjs",
    "unsupported-cjs",
    "overlap",
    "overlap-close",
    "config",
    "startup",
    "bundler",
    "run",
    "compilation",
    "close",
])("buildApp restores environment and permits the next build after %s", scenario => {
    const root = mkdtempSync(path.join(os.tmpdir(), "adnbn-app-environment-"));
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("ADNBN_BUILD_")));

    try {
        const result = spawnSync(
            process.execPath,
            [path.join(scripts, "verify-environment.mjs"), appModule, root, scenario],
            {
                env,
                encoding: "utf8",
                timeout: 30_000,
                maxBuffer: 4 * 1024 * 1024,
            }
        );

        expect(result.error).toBeUndefined();
        expect({status: result.status, stderr: result.stderr}).toEqual({status: 0, stderr: ""});
        expect(result.stdout).toContain("Environment contract verified");
    } finally {
        rmSync(root, {recursive: true, force: true});
    }
});

test("the internal app build returns Stats after shutdown without printing them", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "adnbn-app-lifecycle-"));
    const artifact = path.join(root, "dist/exit-code-chrome-mv3");

    try {
        cpSync(path.join(__dirname, "fixtures/exit-code/lifecycle"), root, {recursive: true});
        const result = spawnSync(process.execPath, [path.join(scripts, "build-api.mjs"), appModule, root, artifact], {
            cwd: root,
            encoding: "utf8",
            timeout: 30_000,
            env: {...process.env, ADNBN_TEST_BUILD_FAILURE: ""},
        });

        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Build API resolved after shutdown");
        expect(stripVTControlCharacters(result.stdout)).not.toContain("compiled successfully");
    } finally {
        rmSync(root, {recursive: true, force: true});
    }
});
