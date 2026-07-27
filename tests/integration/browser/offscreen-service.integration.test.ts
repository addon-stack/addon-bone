/** @jest-environment node */

import {mkdir, mkdtemp, rm, symlink} from "fs/promises";
import {createServer} from "net";
import os from "os";
import path from "path";
import {spawn, spawnSync, type ChildProcess} from "child_process";

type CdpMessage = {
    id?: number;
    method?: string;
    params?: Record<string, unknown>;
    result?: Record<string, any>;
    error?: {message: string};
    sessionId?: string;
};

type CdpTarget = {
    id: string;
    type: string;
    url: string;
    webSocketDebuggerUrl: string;
};

const rootDir = path.resolve(__dirname, "..", "..", "..");
const fixtureDir = path.join(__dirname, "offscreen-service");
const extensionDir = path.join(fixtureDir, "dist", "myapp-chrome-mv3");
const findChromeBinary = (): string | undefined => {
    if (process.env.ADNBN_CHROME_BIN) {
        return process.env.ADNBN_CHROME_BIN;
    }

    const result = spawnSync(
        process.execPath,
        [path.join(rootDir, "node_modules", "chrome-launcher", "bin", "print-chrome-path.cjs")],
        {encoding: "utf8"}
    );
    const chromePath = result.status === 0 ? result.stdout.trim() : "";

    return chromePath || undefined;
};

const chromeBinary = findChromeBinary();

const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

const waitFor = async <T>(callback: () => Promise<T | undefined>, timeout = 15_000): Promise<T> => {
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

    throw new Error(`Timed out waiting for Chrome${detail}`);
};

const getFreePort = (): Promise<number> => {
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

const run = (command: string, args: string[], cwd: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const process = spawn(command, args, {cwd, stdio: ["ignore", "pipe", "pipe"]});
        let output = "";

        process.stdout.on("data", chunk => (output += chunk));
        process.stderr.on("data", chunk => (output += chunk));
        process.once("error", reject);
        process.once("exit", code => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`${command} ${args.join(" ")} exited with ${code}\n${output}`));
            }
        });
    });
};

class CdpClient {
    private nextId = 1;
    private readonly pending = new Map<
        number,
        {resolve: (value: Record<string, any>) => void; reject: (error: Error) => void}
    >();
    private readonly listeners = new Set<(message: CdpMessage) => void>();

    private constructor(private readonly socket: WebSocket) {
        socket.addEventListener("message", event => this.receive(JSON.parse(String(event.data))));
        socket.addEventListener("close", () => this.rejectPending(new Error("Chrome DevTools connection closed")));
        socket.addEventListener("error", () => this.rejectPending(new Error("Chrome DevTools connection failed")));
    }

    public static async connect(url: string): Promise<CdpClient> {
        return new Promise((resolve, reject) => {
            const socket = new WebSocket(url);

            socket.addEventListener("open", () => resolve(new CdpClient(socket)), {once: true});
            socket.addEventListener(
                "error",
                () => reject(new Error(`Unable to connect to Chrome DevTools at ${url}`)),
                {
                    once: true,
                }
            );
        });
    }

    public onMessage(listener: (message: CdpMessage) => void): () => void {
        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    }

    public send(
        method: string,
        params: Record<string, unknown> = {},
        sessionId?: string
    ): Promise<Record<string, any>> {
        const id = this.nextId++;

        this.socket.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));

        return new Promise((resolve, reject) => this.pending.set(id, {resolve, reject}));
    }

    public async close(): Promise<void> {
        if (this.socket.readyState === WebSocket.CLOSED) {
            return;
        }

        await new Promise<void>(resolve => {
            const timeout = setTimeout(resolve, 1_000);

            this.socket.addEventListener(
                "close",
                () => {
                    clearTimeout(timeout);
                    resolve();
                },
                {once: true}
            );
            this.socket.close();
        });
    }

    private receive(message: CdpMessage): void {
        if (message.id !== undefined) {
            const pending = this.pending.get(message.id);

            if (!pending) {
                return;
            }

            this.pending.delete(message.id);

            if (message.error) {
                pending.reject(new Error(message.error.message));
            } else {
                pending.resolve(message.result ?? {});
            }

            return;
        }

        this.listeners.forEach(listener => listener(message));
    }

    private rejectPending(error: Error): void {
        this.pending.forEach(pending => pending.reject(error));
        this.pending.clear();
    }
}

const targets = async (port: number): Promise<CdpTarget[]> => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);

    return response.json() as Promise<CdpTarget[]>;
};

const browserVersion = async (port: number): Promise<{webSocketDebuggerUrl: string}> => {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`);

    return response.json() as Promise<{webSocketDebuggerUrl: string}>;
};

const stop = async (process: ChildProcess): Promise<void> => {
    if (process.exitCode !== null || process.killed) {
        return;
    }

    let timeout: NodeJS.Timeout | undefined;
    const exited = new Promise<boolean>(resolve => {
        process.once("exit", () => {
            if (timeout) {
                clearTimeout(timeout);
            }

            resolve(true);
        });
        timeout = setTimeout(() => resolve(false), 5_000);
    });

    process.kill("SIGTERM");
    const stopped = await exited;

    if (!stopped && process.exitCode === null) {
        process.kill("SIGKILL");
        await new Promise<void>(resolve => process.once("exit", () => resolve()));
    }
};

jest.setTimeout(60_000);

test("Chrome MV3 offscreen calls the registered background service", async () => {
    if (!chromeBinary || !path.isAbsolute(chromeBinary)) {
        throw new Error(
            "Chrome is not installed or could not be found. Install Chrome or set ADNBN_CHROME_BIN to its absolute executable path."
        );
    }

    const frameworkLink = path.join(fixtureDir, "node_modules", "adnbn");
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "adnbn-offscreen-service-"));
    const debuggingPort = await getFreePort();
    let chrome: ChildProcess | undefined;
    let browser: CdpClient | undefined;
    let serviceWorker: CdpClient | undefined;
    let chromeOutput = "";

    try {
        await mkdir(path.dirname(frameworkLink), {recursive: true});
        await symlink(rootDir, frameworkLink, "dir");
        await run(process.execPath, [path.join(rootDir, "bin", "adnbn.js"), "build", ".", "-b", "chrome"], fixtureDir);

        chrome = spawn(
            chromeBinary,
            [
                "--headless=new",
                "--no-first-run",
                "--no-default-browser-check",
                "--enable-logging=stderr",
                "--v=0",
                `--remote-debugging-port=${debuggingPort}`,
                `--user-data-dir=${userDataDir}`,
                "about:blank",
            ],
            {stdio: ["ignore", "ignore", "pipe"]}
        );
        chrome.stderr?.on("data", chunk => (chromeOutput += chunk));

        const {webSocketDebuggerUrl} = await waitFor(() => browserVersion(debuggingPort));
        browser = await CdpClient.connect(webSocketDebuggerUrl);

        const errors: string[] = [];
        const extensionSessions = new Set<string>();

        browser.onMessage(message => {
            if (message.method === "Target.attachedToTarget") {
                const targetInfo = message.params?.targetInfo as {url?: string} | undefined;
                const sessionId = message.params?.sessionId as string | undefined;

                if (sessionId) {
                    if (targetInfo?.url?.startsWith("chrome-extension://")) {
                        extensionSessions.add(sessionId);
                        void browser!
                            .send("Runtime.enable", {}, sessionId)
                            .then(() => browser!.send("Log.enable", {}, sessionId))
                            .finally(() => browser!.send("Runtime.runIfWaitingForDebugger", {}, sessionId))
                            .catch(() => undefined);
                    } else {
                        void browser!.send("Runtime.runIfWaitingForDebugger", {}, sessionId).catch(() => undefined);
                    }
                }

                return;
            }

            if (!message.sessionId || !extensionSessions.has(message.sessionId)) {
                return;
            }

            if (message.method === "Runtime.exceptionThrown") {
                const details = message.params?.exceptionDetails as
                    | {text?: string; exception?: {description?: string}}
                    | undefined;

                errors.push(details?.exception?.description ?? details?.text ?? "Unhandled extension exception");
            }

            if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
                const args = (message.params.args as Array<{value?: unknown; description?: string}> | undefined) ?? [];

                errors.push(args.map(argument => String(argument.value ?? argument.description ?? "")).join(" "));
            }

            if (message.method === "Log.entryAdded") {
                const entry = message.params?.entry as {level?: string; text?: string} | undefined;

                if (entry?.level === "error") {
                    errors.push(entry.text ?? "Chrome extension log error");
                }
            }
        });

        await browser.send("Target.setAutoAttach", {autoAttach: true, waitForDebuggerOnStart: true, flatten: true});
        const extension = await browser.send("Extensions.loadUnpacked", {path: extensionDir});
        const extensionId = extension.id as string | undefined;

        if (!extensionId) {
            throw new Error("Chrome did not return an extension ID after loading the MV3 fixture");
        }

        let chromeTargets: CdpTarget[] = [];
        let worker: CdpTarget;

        try {
            worker = await waitFor(async () => {
                chromeTargets = await targets(debuggingPort);

                return chromeTargets.find(
                    target =>
                        target.type === "service_worker" &&
                        target.url === `chrome-extension://${extensionId}/js/background.js`
                );
            });
        } catch (error) {
            throw new Error(
                `${error instanceof Error ? error.message : String(error)}; CDP targets: ${JSON.stringify(
                    chromeTargets.map(target => ({type: target.type, url: target.url}))
                )}; Chrome output: ${chromeOutput}`
            );
        }

        serviceWorker = await CdpClient.connect(worker.webSocketDebuggerUrl);
        let backgroundState: unknown;

        try {
            await waitFor(async () => {
                const ready = await serviceWorker!.send("Runtime.evaluate", {
                    expression:
                        "({entrypoint: typeof globalThis.__adnbnRunOffscreenRoundTrip, runtime: typeof chrome?.runtime})",
                    returnByValue: true,
                });

                backgroundState = ready.result.value;

                return (ready.result.value as {entrypoint?: string}).entrypoint === "function" ? ready : undefined;
            });
        } catch (error) {
            throw new Error(
                `${error instanceof Error ? error.message : String(error)}; background state: ${JSON.stringify(backgroundState)}`
            );
        }

        const result = await serviceWorker.send("Runtime.evaluate", {
            expression: "globalThis.__adnbnRunOffscreenRoundTrip()",
            awaitPromise: true,
            returnByValue: true,
        });

        expect(result.exceptionDetails).toBeUndefined();
        expect(result.result.value).toBe("background:ping");

        await delay(250);
        expect(errors).toEqual([]);
    } finally {
        await serviceWorker?.close();
        await browser?.close();

        if (chrome) {
            await stop(chrome);
        }

        await rm(path.join(fixtureDir, "node_modules"), {recursive: true, force: true});
        await rm(path.join(fixtureDir, ".adnbn"), {recursive: true, force: true});
        await rm(path.join(fixtureDir, "dist"), {recursive: true, force: true});
        await rm(userDataDir, {recursive: true, force: true});
    }
});
