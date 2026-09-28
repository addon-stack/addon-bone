import {fork, spawnSync} from "node:child_process";
import {mkdirSync, mkdtempSync, rmSync} from "node:fs";
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

test("closing one project does not remove another project's pending virtual entrypoints", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "adnbn-root-dir-parallel-"));
    const projectRoot = path.resolve(__dirname, "../../../..");
    const sharedCwd = path.join(directory, "caller");
    mkdirSync(sharedCwd);

    const start = (name: string) => {
        const root = path.join(directory, name);
        mkdirSync(root);
        const child = fork(
            path.join(__dirname, "scripts/verify-root-dir.mjs"),
            [projectRoot, root, "parallel", sharedCwd],
            {
                execArgv: [],
                stdio: ["ignore", "pipe", "pipe", "ipc"],
                timeout: 60_000,
                killSignal: "SIGKILL",
            }
        );
        let stderr = "";
        child.stdout!.resume();
        child.stderr!.on("data", data => {
            stderr += data;
        });
        const completed = new Promise(resolve =>
            child.once("close", (code, signal) => resolve({code, signal, stderr}))
        );
        const ready = new Promise<void>((resolve, reject) => {
            child.once("message", message => {
                if (message === "ready") {
                    resolve();
                } else {
                    reject(new Error(`Unexpected build message: ${message}`));
                }
            });
            child.once("error", reject);
            child.once("close", () => reject(new Error(`Build stopped before ready: ${stderr}`)));
        });

        return {child, ready, completed};
    };
    const builds = [start("first"), start("second")];

    try {
        await Promise.all(builds.map(build => build.ready));
        // Both compilers have installed their virtual modules. Finish and close one
        // before the other's compilation starts, so shared-directory deletion is observable.
        for (const build of builds) {
            build.child.send("build");
            expect(await build.completed).toEqual({code: 0, signal: null, stderr: ""});
        }
    } finally {
        for (const {child} of builds) {
            if (child.exitCode === null && child.signalCode === null) {
                child.kill("SIGKILL");
            }
        }

        await Promise.all(builds.map(build => build.completed));
        rmSync(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
});
