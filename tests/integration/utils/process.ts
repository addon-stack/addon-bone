import {spawn} from "child_process";

export const run = (command: string, args: string[], cwd: string, timeout = 30_000): Promise<void> => {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {cwd, stdio: ["ignore", "pipe", "pipe"]});
        let output = "";
        let settled = false;

        const finish = (callback: () => void): void => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(runTimeout);
            callback();
        };
        const runTimeout = setTimeout(() => {
            child.kill("SIGKILL");
            finish(() => reject(new Error(`${command} ${args.join(" ")} timed out after ${timeout} ms\n${output}`)));
        }, timeout);

        child.stdout.on("data", chunk => (output += chunk));
        child.stderr.on("data", chunk => (output += chunk));
        child.once("error", error => finish(() => reject(error)));
        child.once("exit", code => {
            if (code === 0) {
                finish(resolve);
            } else {
                finish(() => reject(new Error(`${command} ${args.join(" ")} exited with ${code}\n${output}`)));
            }
        });
    });
};
