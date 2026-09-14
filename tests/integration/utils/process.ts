import {execFileSync, spawn} from "child_process";

const killProcessTree = (pid: number): void => {
    if (process.platform === "win32") {
        execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {stdio: "pipe", timeout: 5_000});
    } else {
        try {
            process.kill(-pid, "SIGKILL");
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        }
    }
};

export const run = (
    command: string,
    args: string[],
    cwd: string,
    timeout = 30_000,
    {stdio = "pipe", killTree = false}: {stdio?: "pipe" | "inherit"; killTree?: boolean} = {}
): Promise<void> => {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            stdio: stdio === "inherit" ? "inherit" : ["ignore", "pipe", "pipe"],
            // A separate POSIX process group lets a timeout reach wrappers, workers and their children.
            detached: killTree && process.platform !== "win32",
        });
        let output = "";
        let settled = false;
        let timedOut = false;
        let terminating = false;
        let interrupted: NodeJS.Signals | undefined;
        const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];
        const closeOutput = () => {
            child.stdout?.destroy();
            child.stderr?.destroy();
        };

        const finish = (callback: () => void): void => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(runTimeout);
            if (killTree) for (const signal of signals) process.off(signal, interrupt);
            callback();
        };
        const terminate = () => {
            if (terminating) return;
            terminating = true;
            try {
                if (killTree && child.pid) killProcessTree(child.pid);
                else if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
                if (child.exitCode !== null || child.signalCode !== null) closeOutput();
            } catch (error) {
                closeOutput();
                finish(() => reject(error));
            }
        };
        const interrupt = (signal: NodeJS.Signals) => {
            interrupted = signal;
            terminate();
        };
        // Detached groups no longer receive terminal signals together with the hook.
        if (killTree) for (const signal of signals) process.on(signal, interrupt);
        const runTimeout = setTimeout(() => {
            timedOut = true;
            terminate();
        }, timeout);

        child.stdout?.on("data", chunk => (output += chunk));
        child.stderr?.on("data", chunk => (output += chunk));
        child.once("error", error => finish(() => reject(error)));
        child.once("exit", () => {
            // A descendant can inherit these pipes; it must not keep a timed-out command pending.
            if (timedOut || interrupted) closeOutput();
        });
        // exit precedes draining stdout/stderr; close means the fixture process is fully finished.
        child.once("close", (code, signal) => {
            if (timedOut) {
                finish(() =>
                    reject(new Error(`[${cwd}] ${command} ${args.join(" ")} timed out after ${timeout} ms\n${output}`))
                );
            } else if (interrupted) {
                finish(() =>
                    reject(new Error(`[${cwd}] ${command} ${args.join(" ")} interrupted by ${interrupted}\n${output}`))
                );
            } else if (code === 0) {
                finish(resolve);
            } else {
                finish(() =>
                    reject(new Error(`[${cwd}] ${command} ${args.join(" ")} exited with ${signal ?? code}\n${output}`))
                );
            }
        });
    });
};
