import {createServer} from "net";
import type {ChildProcess} from "child_process";

const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

export const waitFor = async <T>(callback: () => Promise<T | undefined>, timeout = 15_000): Promise<T> => {
    const deadline = Date.now() + timeout;
    let lastError: unknown;

    while (Date.now() < deadline) {
        try {
            const value = await callback();

            if (value !== undefined) {
                return value;
            }
        } catch (error) {
            lastError = error;
        }

        await delay(100);
    }

    const detail = lastError instanceof Error ? `: ${lastError.message}` : "";

    throw new Error(`Timed out waiting for the browser${detail}`);
};

export const getFreePort = (): Promise<number> => {
    return new Promise((resolve, reject) => {
        const server = createServer();

        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();

            if (!address || typeof address === "string") {
                server.close();
                reject(new Error("Unable to reserve a debugging port"));

                return;
            }

            server.close(error => (error ? reject(error) : resolve(address.port)));
        });
    });
};

export const stop = async (process: ChildProcess): Promise<void> => {
    if (process.exitCode !== null || process.killed) {
        return;
    }

    const waitForExit = (timeout: number): Promise<boolean> =>
        new Promise(resolve => {
            const onExit = () => {
                clearTimeout(timer);
                resolve(true);
            };
            const timer = setTimeout(() => {
                process.off("exit", onExit);
                resolve(false);
            }, timeout);

            process.once("exit", onExit);
        });

    const stopProcess = (signal: NodeJS.Signals): void => {
        try {
            process.kill(signal);
        } catch (error) {
            if (!(error instanceof Error) || !error.message.includes("ESRCH")) {
                throw error;
            }
        }
    };

    const stopped = waitForExit(5_000);

    stopProcess("SIGTERM");

    if (!(await stopped) && process.exitCode === null) {
        const killed = waitForExit(5_000);

        stopProcess("SIGKILL");
        await killed;
    }
};
