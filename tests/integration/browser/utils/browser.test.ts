import {spawn} from "node:child_process";
import {once} from "node:events";
import {stop} from "./browser";

test("waits for a process that has received a signal but has not exited yet", async () => {
    const child = spawn(process.execPath, ["-e", 'process.stdout.write("ready"); setInterval(() => {}, 1000)'], {
        stdio: ["ignore", "pipe", "pipe"],
    });
    try {
        await once(child.stdout!, "data");
        child.kill("SIGTERM");
        expect(child.killed).toBe(true);
        await stop(child);
        expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
        expect(child.stdout!.destroyed).toBe(true);
        expect(child.stderr!.destroyed).toBe(true);
        await stop(child);
    } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
});
