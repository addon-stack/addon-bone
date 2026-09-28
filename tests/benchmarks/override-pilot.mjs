import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {performance} from "node:perf_hooks";

const root = path.resolve(import.meta.dirname, "../..");
const output = path.join(root, ".cache/benchmarks/override-session");
fs.mkdirSync(output, {recursive: true});
const flags = ["--expose-gc", ...(process.platform === "darwin" && process.arch === "arm64" ? ["--no-sparkplug"] : [])];
const report = {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    flags,
    runs: [],
};
let expectedNames;

const leftovers = () =>
    fs.readdirSync(path.join(root, ".cache/integration")).filter(name => /^(fixture|session)-/.test(name));
assert.deepEqual(leftovers(), [], "Account for existing test directories before running the benchmark");

const readSamples = filename => fs.readFileSync(filename, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
const run = (mode, workers, phase, extra = []) => {
    const id = `${report.runs.length + 1}-${phase}-${workers}-${mode}`;
    const metrics = path.join(output, `${id}.jsonl`);
    const childMetrics = path.join(output, `${id}-children.jsonl`);
    const resultPath = path.join(output, `${id}.json`);
    const log = path.join(output, `${id}.log`);
    fs.writeFileSync(metrics, "");
    fs.writeFileSync(childMetrics, "");
    const started = performance.now();
    const result = spawnSync(
        process.execPath,
        [
            ...flags,
            "node_modules/jest/bin/jest.js",
            "--selectProjects",
            "build",
            "--testPathPatterns=tests/integration/build/override",
            `--maxWorkers=${workers}`,
            "--logHeapUsage",
            "--json",
            `--outputFile=${resultPath}`,
            "--setupFilesAfterEnv",
            path.join(root, "tests/jest.setup.ts"),
            path.join(import.meta.dirname, "override-pilot-metrics.cjs"),
            ...extra,
        ],
        {
            cwd: root,
            env: {
                ...process.env,
                ADNBN_OVERRIDE_BUILD_MODE: mode,
                ADNBN_PILOT_METRICS: metrics,
                ADNBN_SESSION_METRICS: childMetrics,
            },
            encoding: "utf8",
            timeout: 180_000,
            maxBuffer: 8 * 1024 * 1024,
        }
    );
    const wallSeconds = (performance.now() - started) / 1000;
    fs.writeFileSync(log, result.stdout + result.stderr);

    if (result.error || result.status !== 0) {
        throw new Error(`${id} failed: ${result.error ?? result.status}; see ${log}`);
    }

    const data = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    const names = data.testResults.flatMap(file => file.assertionResults.map(test => test.fullName)).sort();
    expectedNames ??= names;
    assert.equal(names.length, 33);
    assert.equal(new Set(names).size, 33);
    assert.deepEqual(names, expectedNames);
    assert.deepEqual(leftovers(), []);
    const children = readSamples(childMetrics);
    const pids = [...new Set(children.map(sample => sample.pid))];

    if (mode === "session") {
        assert.equal(children.length, 30);
        assert.equal(pids.length, 3);

        for (const pid of pids) {
            assert.deepEqual(
                children.filter(sample => sample.pid === pid).map(sample => sample.build),
                [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
            );
            assert.throws(() => process.kill(pid, 0), {code: "ESRCH"});
        }
    }

    report.runs.push({
        id,
        phase,
        mode,
        workers,
        wallSeconds,
        names,
        tests: data.numPassedTests,
        leftovers: leftovers().length,
        openHandles: data.openHandles?.length ?? null,
        children: children.map(sample => ({
            ...sample,
            rootDir: path.relative(root, sample.rootDir),
            cwd: path.relative(root, sample.cwd),
        })),
        parentSamples: readSamples(metrics).map(sample => ({...sample, file: path.relative(root, sample.file)})),
    });
    fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(
        `${id}: ${wallSeconds.toFixed(2)} s; 33 tests, ${pids.length} session children, no leftover processes/directories`
    );
};

for (const workers of [2, 8]) {
    for (const mode of ["cli", "session"]) {
        run(mode, workers, "warmup");
    }

    for (let round = 0; round < 3; round++) {
        for (const mode of round % 2 ? ["session", "cli"] : ["cli", "session"]) {
            run(mode, workers, "measured");
        }
    }
}

for (const mode of ["cli", "session"]) {
    run(mode, 1, "handles", ["--detectOpenHandles"]);
}
