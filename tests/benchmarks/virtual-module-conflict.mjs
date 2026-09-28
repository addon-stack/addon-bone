import assert from "node:assert/strict";
import {fork} from "node:child_process";
import {mkdirSync, mkdtempSync, rmSync} from "node:fs";
import os from "node:os";
import path from "node:path";

const reproduce = async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "adnbn-root-dir-parallel-"));
    const projectRoot = path.resolve(import.meta.dirname, "../..");
    const sharedCwd = path.join(directory, "caller");
    mkdirSync(path.join(sharedCwd, "node_modules", "entrypoint"), {recursive: true});
    mkdirSync(path.join(sharedCwd, "node_modules", "virtual"));

    const start = name => {
        const root = path.join(directory, name);
        mkdirSync(root);
        const child = fork(
            path.join(projectRoot, "tests/integration/build/cli/scripts/verify-root-dir.mjs"),
            [projectRoot, root, "parallel", sharedCwd],
            {
                execArgv: [],
                stdio: ["ignore", "pipe", "pipe", "ipc"],
                timeout: 60_000,
                killSignal: "SIGKILL",
            }
        );
        let stderr = "";
        child.stdout.resume();
        child.stderr.on("data", data => {
            stderr += data;
        });
        const completed = new Promise(resolve =>
            child.once("close", (code, signal) => resolve({code, signal, stderr}))
        );
        const ready = new Promise((resolve, reject) => {
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
        builds[0].child.send("build");
        assert.deepEqual(await builds[0].completed, {code: 0, signal: null, stderr: ""});
        builds[1].child.send("build");
        const failed = await builds[1].completed;
        assert.notEqual(failed.code, 0);
        assert.match(failed.stderr, /Cannot find module|Module not found/);
        console.log("Confirmed external-plugin limitation: closing A removes B virtual modules");
    } finally {
        for (const {child} of builds) {
            if (child.exitCode === null && child.signalCode === null) {
                child.kill("SIGKILL");
            }
        }

        await Promise.all(builds.map(build => build.completed));
        rmSync(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
};

await reproduce();
