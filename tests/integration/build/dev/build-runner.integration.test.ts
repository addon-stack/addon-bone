import {jest} from "@jest/globals";

import {fork} from "child_process";
import {readdir, readFile, writeFile} from "fs/promises";
import path from "path";
import {pathToFileURL} from "url";

import {waitFor} from "../../browser/utils/browser";
import {createIntegrationFixture, type IntegrationFixture} from "../../utils/fixture";

import type BuildRunnerClass from "@cli/builders/app/dev/BuildRunner";
import type {
    BuildRunnerCompileEvent,
    BuildRunnerDoneEvent,
    BuildRunnerEvent,
    BuildRunnerFatalEvent,
} from "@cli/builders/app/dev/protocol";
import {Browser} from "@typing/browser";

const rootDir = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const fixtureDir = path.join(rootDir, "tests", "integration", "dev", "fixtures", "basic");
const childScript = path.join(rootDir, "dist", "cli", "builders", "app", "dev", "build-runner-child.js");

jest.setTimeout(120_000);

let BuildRunner: typeof BuildRunnerClass;

beforeAll(async () => {
    // The runner forks its build process from the built package, as the CLI will.
    const runnerModule = pathToFileURL(path.join(rootDir, "dist", "cli", "builders", "app", "dev", "BuildRunner.js"));

    BuildRunner = ((await import(runnerModule.href)) as {default: typeof BuildRunnerClass}).default;
});

interface RunnerScenario {
    fixture: IntegrationFixture;
    runner: BuildRunnerClass;
    events: BuildRunnerEvent[];
    output: string;
}

const scenarios: RunnerScenario[] = [];

afterEach(async () => {
    for (const {runner, fixture} of scenarios.splice(0)) {
        await runner.close();
        await fixture.dispose();
    }
});

const prepare = async (): Promise<IntegrationFixture> => {
    const fixture = await createIntegrationFixture(rootDir, fixtureDir);

    await fixture.link();

    return fixture;
};

const start = (fixture: IntegrationFixture, buildId?: number): RunnerScenario => {
    const runner = BuildRunner.start({rootDir: fixture.directory, browser: Browser.Chrome}, buildId);
    const events: BuildRunnerEvent[] = [];
    const scenario = {fixture, runner, events, output: path.join(fixture.directory, "dist", "addon-chrome-mv3")};

    runner.on(event => events.push(event));
    scenarios.push(scenario);

    return scenario;
};

const compiles = (events: BuildRunnerEvent[]): BuildRunnerCompileEvent[] => {
    return events.filter((event): event is BuildRunnerCompileEvent => event.type === "compile");
};

const dones = (events: BuildRunnerEvent[]): BuildRunnerDoneEvent[] => {
    return events.filter((event): event is BuildRunnerDoneEvent => event.type === "done");
};

/** The next finished compilation after `after` whose announced changes include `file`. */
const waitForDone = (
    {events, runner}: RunnerScenario,
    description: string,
    file?: string,
    after = 0
): Promise<BuildRunnerDoneEvent> => {
    return waitFor(
        async () => {
            const fatal = events.find((event): event is BuildRunnerFatalEvent => event.type === "fatal");

            if (fatal) {
                throw new Error(`${fatal.code}: ${fatal.message}\n${runner.output}`);
            }

            return dones(events).find(done => {
                if (done.buildId <= after) {
                    return false;
                }

                const compile = compiles(events).find(event => event.buildId === done.buildId);

                return !file || compile?.modifiedFiles.some(changed => changed.endsWith(file));
            });
        },
        30_000,
        description
    );
};

/** Compilations are numbered monotonically and every result belongs to the latest announced compilation. */
const expectConsistentEvents = (events: BuildRunnerEvent[]): void => {
    let latest: number | undefined;

    for (const event of events) {
        if (event.type === "compile") {
            expect(latest === undefined || event.buildId > latest).toBe(true);
            latest = event.buildId;
        }

        if (event.type === "done") {
            expect(event.buildId).toBe(latest);
        }
    }
};

const edit = async (directory: string, file: string, from: string, to: string): Promise<void> => {
    const target = path.join(directory, file);
    const source = await readFile(target, "utf8");

    expect(source).toContain(from);

    await writeFile(target, source.replace(from, to));
};

const snapshot = async (directory: string): Promise<Map<string, string>> => {
    const files = new Map<string, string>();

    for (const entry of await readdir(directory, {recursive: true, withFileTypes: true})) {
        if (entry.isFile()) {
            const file = path.join(entry.parentPath, entry.name);

            files.set(path.relative(directory, file), await readFile(file, "base64"));
        }
    }

    return files;
};

const isRunning = (pid: number | undefined): boolean => {
    if (pid === undefined) {
        return false;
    }

    try {
        process.kill(pid, 0);

        return true;
    } catch {
        return false;
    }
};

const optionsFile = path.join("src", "options.ts");
const contentFile = path.join("src", "badge.content.ts");

test("builds the application in dev mode and numbers each compilation", async () => {
    const scenario = start(await prepare());
    const done = await waitForDone(scenario, "the first dev build");

    expect(done).toMatchObject({buildId: 1, ok: true, errors: []});
    expect(compiles(scenario.events)[0].buildId).toBe(1);

    const files = Array.from((await snapshot(scenario.output)).keys()).map(file => file.split(path.sep).join("/"));

    // Development output: stable entry names and external source maps.
    expect(files).toEqual(
        expect.arrayContaining(["js/background.js", "js/background.js.map", "js/options.js", "manifest.json"])
    );
});

test("keeps the previous output when a compilation fails and emits the fix", async () => {
    const scenario = start(await prepare());
    const first = await waitForDone(scenario, "the first dev build");
    const before = await snapshot(scenario.output);

    await edit(scenario.fixture.directory, optionsFile, "return main;", "return main; const broken = ;");

    const failed = await waitForDone(scenario, "the failed compilation", optionsFile, first.buildId);

    expect(failed.ok).toBe(false);
    expect(failed.errors.join("\n")).toContain("options.ts");
    expect(await snapshot(scenario.output)).toEqual(before);

    // One write: two separate writes may produce two compilations.
    await edit(
        scenario.fixture.directory,
        optionsFile,
        `main.textContent = "Dev basic options";

        return main; const broken = ;`,
        `main.textContent = "Dev basic options fixed";

        return main;`
    );

    const fixed = await waitForDone(scenario, "the fixed compilation", optionsFile, failed.buildId);

    expect(fixed.ok).toBe(true);
    expect(await readFile(path.join(scenario.output, "js", "options.js"), "utf8")).toContain("Dev basic options fixed");
    expectConsistentEvents(scenario.events);
});

test("keeps the previous output even when a user plugin re-enables emitting on errors", async () => {
    const fixture = await prepare();

    await writeFile(
        path.join(fixture.directory, "adnbn.config.ts"),
        `import {defineConfig, definePlugin} from "adnbn";

const emitOnErrors = definePlugin(() => ({
    name: "emit-on-errors",
    bundler: () => ({optimization: {emitOnErrors: true}}),
}));

export default defineConfig({
    name: "Dev Basic",
    version: "1.0.0",
    jsFilename: "[name].js",
    cssFilename: "[name].css",
    plugins: [emitOnErrors()],
});
`
    );

    const scenario = start(fixture);
    const first = await waitForDone(scenario, "the first dev build");
    const before = await snapshot(scenario.output);

    await edit(fixture.directory, optionsFile, "return main;", "return main; const broken = ;");

    const failed = await waitForDone(scenario, "the failed compilation", optionsFile, first.buildId);

    expect(failed.ok).toBe(false);
    expect(await snapshot(scenario.output)).toEqual(before);
});

test("keeps watch-mode features: content options update the manifest", async () => {
    const scenario = start(await prepare());
    const first = await waitForDone(scenario, "the first dev build");

    await edit(scenario.fixture.directory, contentFile, `"http://127.0.0.1/*"`, `"https://example.com/*"`);

    const done = await waitForDone(scenario, "the content options compilation", contentFile, first.buildId);
    const manifest = JSON.parse(await readFile(path.join(scenario.output, "manifest.json"), "utf8"));

    expect(done.ok).toBe(true);
    expect(manifest.content_scripts[0].matches).toEqual(["https://example.com/*"]);
    expectConsistentEvents(scenario.events);
});

test("reports a configuration failure and exits with code 1", async () => {
    const fixture = await prepare();

    await writeFile(path.join(fixture.directory, "adnbn.config.ts"), `throw new Error("broken dev config");\n`);

    const scenario = start(fixture);
    const fatal = await waitFor(
        async () => scenario.events.find((event): event is BuildRunnerFatalEvent => event.type === "fatal"),
        30_000,
        "the configuration failure"
    );

    expect(fatal).toMatchObject({code: "E_CONFIG_FAILED"});
    expect(fatal.message).toContain("broken dev config");
    expect((await scenario.runner.exited).code).toBe(1);
});

test("starts numbering from the requested build id", async () => {
    const scenario = start(await prepare(), 7);
    const done = await waitForDone(scenario, "the first dev build");

    expect(compiles(scenario.events)[0].buildId).toBe(7);
    expect(done.buildId).toBe(7);
});

test("closes after a build and while starting", async () => {
    const built = start(await prepare());

    await waitForDone(built, "the first dev build");

    const pid = built.runner.pid;

    expect(await built.runner.close()).toMatchObject({code: 0});
    expect(isRunning(pid)).toBe(false);

    const starting = start(await prepare());

    expect(await starting.runner.close()).toMatchObject({code: 0});
    expect(dones(starting.events)).toEqual([]);
});

/** A project whose plugin makes Rspack's shutdown hook run `shutdown` when the compiler closes. */
const prepareShutdown = async (shutdown: string): Promise<IntegrationFixture> => {
    const fixture = await prepare();

    await writeFile(
        path.join(fixture.directory, "adnbn.config.ts"),
        `import {defineConfig, definePlugin} from "adnbn";

const shutdown = definePlugin(() => ({
    name: "shutdown",
    bundler: () => ({
        plugins: [
            {
                apply(compiler: any) {
                    compiler.hooks.shutdown.tapPromise("shutdown", ${shutdown});
                },
            },
        ],
    }),
}));

export default defineConfig({
    name: "Dev Basic",
    version: "1.0.0",
    jsFilename: "[name].js",
    cssFilename: "[name].css",
    plugins: [shutdown()],
});
`
    );

    return fixture;
};

const closeFailure = (events: BuildRunnerEvent[]): BuildRunnerFatalEvent | undefined => {
    return events.find((event): event is BuildRunnerFatalEvent => event.type === "fatal");
};

test("reports a compiler that fails to close and exits with code 1", async () => {
    const scenario = start(await prepareShutdown(`() => Promise.reject(new Error("shutdown hook failed"))`));

    await waitForDone(scenario, "the first dev build");

    expect(await scenario.runner.close()).toMatchObject({code: 1, signal: null});
    expect(closeFailure(scenario.events)).toMatchObject({code: "E_CLOSE_FAILED"});
    expect(closeFailure(scenario.events)?.message).toContain("shutdown hook failed");
});

test("reports a compiler that does not close in time and exits with code 1", async () => {
    const scenario = start(await prepareShutdown(`() => new Promise(() => {})`));

    await waitForDone(scenario, "the first dev build");

    const pid = scenario.runner.pid;

    // The process reports the timeout itself, so it exits before the runner would have to kill it.
    expect(await scenario.runner.close(1_000)).toMatchObject({code: 1, signal: null});
    expect(closeFailure(scenario.events)).toMatchObject({code: "E_CLOSE_FAILED"});
    expect(closeFailure(scenario.events)?.message).toContain("did not close within 1000 ms");
    expect(isRunning(pid)).toBe(false);
});

test("exits when the parent disconnects", async () => {
    const fixture = await prepare();
    const child = fork(childScript, [], {cwd: fixture.directory, stdio: ["ignore", "ignore", "ignore", "ipc"]});

    try {
        const exited = new Promise<number | null>(resolve => child.once("exit", code => resolve(code)));

        child.send({type: "start", options: {rootDir: fixture.directory, browser: "chrome"}, buildId: 1});
        child.disconnect();

        expect(await exited).toBe(0);
    } finally {
        child.kill("SIGKILL");
        await fixture.dispose();
    }
});
