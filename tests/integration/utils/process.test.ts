import {mkdtemp, readFile, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {waitFor} from "../browser/utils/browser";
import {run} from "./process";

test("reports the complete diagnostics after a failing child drains its output", async () => {
    await expect(
        run(
            process.execPath,
            ["-e", 'process.stdout.write("x".repeat(100000) + "last diagnostic", () => process.exit(2))'],
            ADNBN_TEST_ROOT
        )
    ).rejects.toThrow(/exited with 2\n[x]+last diagnostic$/);
});

test("terminates a fixture that exceeds its deadline", async () => {
    await expect(run(process.execPath, ["-e", "setInterval(() => {}, 1000)"], ADNBN_TEST_ROOT, 100)).rejects.toThrow(
        "timed out after 100 ms"
    );
});

test("reports command failures when stdout and stderr are inherited", async () => {
    await expect(
        run(process.execPath, ["-e", "process.exit(2)"], ADNBN_TEST_ROOT, 1000, {stdio: "inherit"})
    ).rejects.toThrow("exited with 2");
});

test("terminates a wrapper and all descendants with inherited output on timeout", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "adnbn-process-tree-"));
    const marker = path.join(directory, "pids.json");
    let pids: number[] = [];
    const outcome = run(
        process.execPath,
        [path.join(__dirname, "fixtures/process-tree.cjs"), "2", marker],
        ADNBN_TEST_ROOT,
        2000,
        {stdio: "inherit", killTree: true}
    ).catch(error => error as Error);
    try {
        pids = await waitFor(
            async () => JSON.parse(await readFile(marker, "utf8")) as number[],
            5000,
            "three ready processes"
        );
        expect(pids).toHaveLength(3);
        expect(await outcome).toEqual(
            expect.objectContaining({message: expect.stringContaining("timed out after 2000 ms")})
        );
        await waitFor(
            async () => {
                for (const pid of pids) {
                    try {
                        process.kill(pid, 0);
                        return undefined;
                    } catch (error) {
                        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
                    }
                }
                return true;
            },
            5000,
            "the wrapper and all descendants to exit"
        );
        pids = [];
    } finally {
        await outcome;
        for (const pid of pids) {
            try {
                process.kill(pid, "SIGKILL");
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
            }
        }
        await rm(directory, {recursive: true, force: true});
    }
}, 15000);
