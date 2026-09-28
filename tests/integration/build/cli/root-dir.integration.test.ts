import {spawnSync} from "node:child_process";
import {mkdtempSync, rmSync} from "node:fs";
import os from "node:os";
import path from "node:path";

jest.setTimeout(90_000);

test.each(["api", "cli"])("%s builds absolute roots from an unrelated working directory", mode => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "adnbn-root-dir-"));
    const projectRoot = path.resolve(__dirname, "../../../..");

    try {
        const result = spawnSync(
            process.execPath,
            [path.join(__dirname, "scripts/verify-root-dir.mjs"), projectRoot, directory, mode],
            {encoding: "utf8", timeout: 60_000, maxBuffer: 4 * 1024 * 1024}
        );

        expect(result.error).toBeUndefined();
        expect({status: result.status, stderr: result.stderr}).toEqual({status: 0, stderr: ""});
        expect(result.stdout).toContain("Absolute root contract verified");
    } finally {
        rmSync(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
});
