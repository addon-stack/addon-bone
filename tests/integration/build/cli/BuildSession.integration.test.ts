import {fork} from "node:child_process";
import {cp, mkdir, mkdtemp, readFile, rm, symlink, access} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import BuildSession, {BuildSessionError} from "../../utils/BuildSession";

const projectRoot = path.resolve(__dirname, "../../../..");
const fixtures = path.join(__dirname, "fixtures");
let directory: string;
let root: string;
let session: BuildSession;

jest.setTimeout(60_000);

beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "adnbn-session-test-"));
    root = path.join(directory, "project a");
    await cp(path.join(fixtures, "root-dir"), root, {recursive: true});
    await cp(path.join(fixtures, "build-session/adnbn.config.ts"), path.join(root, "adnbn.config.ts"));
    await mkdir(path.join(root, "node_modules"));
    await symlink(
        projectRoot,
        path.join(root, "node_modules/adnbn"),
        process.platform === "win32" ? "junction" : "dir"
    );

    session = await BuildSession.create(projectRoot);
});

afterEach(async () => {
    delete process.env.ADNBN_SESSION_CASE;
    await session?.dispose();
    await rm(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
});

test("reuses one child with fixed cwd across A-B-A, rejects overlap and restores the parent", async () => {
    const cwd = process.cwd();
    const environment = {...process.env};
    const rootB = path.join(directory, "project b");
    await cp(root, rootB, {recursive: true, filter: source => path.basename(source) !== "node_modules"});
    await mkdir(path.join(rootB, "node_modules"));
    await symlink(
        projectRoot,
        path.join(rootB, "node_modules/adnbn"),
        process.platform === "win32" ? "junction" : "dir"
    );

    await cp(path.join(fixtures, "root-dir-b"), path.join(rootB, "src"), {recursive: true});
    const first = session.build(root);
    await expect(session.build(rootB)).rejects.toThrow("pending request");
    const samples = [await first, await session.build(rootB, "firefox"), await session.build(root)];

    expect(samples.map(sample => sample.pid)).toEqual([session.pid, session.pid, session.pid]);
    expect(samples.map(sample => sample.build)).toEqual([1, 2, 3]);
    expect(samples.map(sample => sample.cwd)).toEqual(Array(3).fill(session.directory));
    expect(samples.every(sample => sample.rss > 0 && sample.heapUsed > 0)).toBe(true);
    expect(await readFile(path.join(root, "dist/addon-chrome-mv3/newtab.html"), "utf8")).toContain("Absolute root A");
    expect(await readFile(path.join(rootB, "dist/addon-firefox-mv3/newtab.html"), "utf8")).toContain("Absolute root B");
    expect(process.cwd()).toBe(cwd);
    expect({...process.env}).toEqual(environment);
    await session.dispose();
    await expect(access(session.directory)).rejects.toMatchObject({code: "ENOENT"});
    await expect(session.build(root)).rejects.toThrow("closed");
});

test("preserves the original error cause and can build after a config failure", async () => {
    process.env.ADNBN_SESSION_CASE = "error";
    await expect(session.build(root)).rejects.toMatchObject({
        message: expect.stringContaining("Session config failed"),
        cause: {message: "Original config cause"},
    });

    delete process.env.ADNBN_SESSION_CASE;
    await expect(session.build(root)).resolves.toMatchObject({pid: session.pid, build: 2});
});

test("serializes compiler diagnostics and recovers after a failed compilation", async () => {
    await cp(path.join(fixtures, "build-session/invalid-newtab.ts"), path.join(root, "src/newtab.ts"));
    const error = await session.build(root).catch(error => error);
    expect(error).toBeInstanceOf(BuildSessionError);
    expect(error.stats).toContain("missing-runtime");
    await cp(path.join(fixtures, "root-dir/src/newtab.ts"), path.join(root, "src/newtab.ts"));
    await expect(session.build(root)).resolves.toMatchObject({build: 2});
});

test("kills a timed-out child, waits for close and never retries", async () => {
    process.env.ADNBN_SESSION_CASE = "hang";
    await expect(session.build(root, "chrome", 3, 3_000)).rejects.toThrow("timed out");
    expect(() => process.kill(session.pid!, 0)).toThrow();
    await expect(session.build(root)).rejects.toThrow("closed");
});

test("rejects an unexpected child exit without leaving a pending request", async () => {
    process.env.ADNBN_SESSION_CASE = "exit";
    await expect(session.build(root)).rejects.toThrow("exited with 9");
    await expect(session.build(root)).rejects.toThrow("closed");
});

test("disposing a pending build rejects it and removes the session after close", async () => {
    process.env.ADNBN_SESSION_CASE = "hang";
    const pending = session.build(root);
    const rejected = expect(pending).rejects.toThrow("disposed during a pending request");
    await session.dispose();
    await rejected;
    expect(() => process.kill(session.pid!, 0)).toThrow();
    await expect(access(session.directory)).rejects.toMatchObject({code: "ENOENT"});
});

test.each([false, true])("child exits on IPC disconnect (active build: %s)", async active => {
    const child = fork(path.join(projectRoot, "tests/integration/utils/build-session-child.mjs"), [projectRoot], {
        cwd: session.directory,
        execArgv: [],
        stdio: ["ignore", "ignore", "pipe", "ipc"],
    });

    let stderr = "";
    child.stderr!.on("data", chunk => {
        stderr += chunk;
    });

    const exited = new Promise(resolve => child.once("exit", (code, signal) => resolve({code, signal})));
    const ready = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Child did not become ready: ${stderr}`)), 15_000);
        child.on("message", message => {
            if ((message as {ready?: boolean; started?: boolean})[active ? "started" : "ready"]) {
                clearTimeout(timer);
                resolve();
            }
        });

        child.once("error", error => {
            clearTimeout(timer);
            reject(error);
        });
    });

    const deadline = setTimeout(() => child.kill("SIGKILL"), 20_000);

    try {
        if (active) {
            child.send({
                id: 1,
                rootDir: root,
                browser: "chrome",
                manifestVersion: 3,
                environment: {...process.env, ADNBN_SESSION_CASE: "hang"},
            });
        }

        await ready;
        child.disconnect();
        await expect(exited).resolves.toEqual({code: 0, signal: null});
    } finally {
        clearTimeout(deadline);
        child.kill("SIGKILL");
        await exited;
    }
});
