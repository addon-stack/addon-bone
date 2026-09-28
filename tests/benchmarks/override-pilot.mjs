import {spawnSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {performance} from "node:perf_hooks";

const root = path.resolve(import.meta.dirname, "../..");
const output = path.join(root, ".cache/benchmarks/override-pilot");
fs.mkdirSync(output, {recursive: true});
const flags = ["--expose-gc", ...(process.platform === "darwin" && process.arch === "arm64" ? ["--no-sparkplug"] : [])];
const stressOnly = process.argv.includes("--stress-only");
const resume = process.argv.includes("--limits-only") || stressOnly;
const report = resume
    ? JSON.parse(fs.readFileSync(path.join(output, "results.json"), "utf8"))
    : {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          cpus: os.cpus().length,
          flags,
          runs: [],
      };
let sequence = report.runs.length;
let expectedNames = report.runs[0]?.names;

const run = (mode, workers, phase, extra = []) => {
    const id = `${++sequence}-${phase}-${workers}-${mode}`;
    const metrics = path.join(output, `${id}.jsonl`);
    const resultPath = path.join(output, `${id}.json`);
    const log = path.join(output, `${id}.log`);
    fs.writeFileSync(metrics, "");
    const args = [
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
    ];
    const started = performance.now();
    const result = spawnSync(process.execPath, args, {
        cwd: root,
        env: {...process.env, ADNBN_OVERRIDE_BUILD_MODE: mode, ADNBN_PILOT_METRICS: metrics},
        encoding: "utf8",
        timeout: 180_000,
        maxBuffer: 8 * 1024 * 1024,
    });
    const wallSeconds = (performance.now() - started) / 1000;
    fs.writeFileSync(log, result.stdout + result.stderr);

    if (result.error || result.status !== 0) {
        throw new Error(`${id} failed: ${result.error ?? result.status}; see ${log}`);
    }

    const data = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    const names = data.testResults.flatMap(file => file.assertionResults.map(test => test.fullName)).sort();
    expectedNames ??= names;

    if (names.length !== 33 || JSON.stringify(names) !== JSON.stringify(expectedNames)) {
        throw new Error(`${id}: scenario inventory changed`);
    }

    const leftovers = fs.readdirSync(path.join(root, ".cache/integration")).filter(name => name.startsWith("fixture-"));

    if (leftovers.length) {
        throw new Error(`${id}: ${leftovers.length} fixture copies remain`);
    }

    const samples = fs
        .readFileSync(metrics, "utf8")
        .trim()
        .split("\n")
        .map(JSON.parse)
        .map(sample => ({...sample, file: path.relative(root, sample.file)}));
    const entry = {
        id,
        phase,
        mode,
        workers,
        wallSeconds,
        tests: data.numPassedTests,
        names,
        leftovers: leftovers.length,
        openHandles: data.openHandles?.length ?? null,
        samples,
        files: data.testResults.map(file => ({
            path: path.relative(root, file.name),
            seconds: (file.endTime - file.startTime) / 1000,
        })),
        heapOutput: result.stderr.split("\n").filter(line => line.includes("heap size")),
    };
    report.runs.push(entry);
    fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(`${id}: ${wallSeconds.toFixed(2)} s, 33 tests, 0 leftover copies`);
};

if (!resume) {
    for (const workers of [2, 8]) {
        for (const mode of ["cli", "in-process"]) {
            run(mode, workers, "warmup");
        }

        for (let round = 0; round < 3; round++) {
            for (const mode of round % 2 ? ["in-process", "cli"] : ["cli", "in-process"]) {
                run(mode, workers, "measured");
            }
        }
    }

    for (const mode of ["cli", "in-process"]) {
        run(mode, 1, "memory");
        run(mode, 1, "handles", ["--detectOpenHandles"]);
    }
}

if (!stressOnly) {
    for (const workers of [2, 8]) {
        for (let round = 0; round < 3; round++) {
            run("in-process", workers, "limited", ["--workerIdleMemoryLimit=128MB"]);
        }
    }
}

if (!resume || stressOnly) {
    const temporary = path.join(root, "tests/integration/build/override/memory-pilot.integration.test.ts");

    if (fs.existsSync(temporary)) {
        throw new Error(`Refusing to replace ${temporary}`);
    }

    const cases = ["newtab", "history", "bookmarks"]
        .map(
            page =>
                fs
                    .readFileSync(path.join(path.dirname(temporary), `${page}.integration.test.ts`), "utf8")
                    .split("jest.setTimeout(90_000);")[1]
        )
        .join("\n");
    const metrics = path.join(output, "stress.jsonl");
    const resultPath = path.join(output, "stress.json");
    fs.writeFileSync(metrics, "");

    try {
        fs.writeFileSync(
            temporary,
            'import {testOverridePage} from "./override-utils";\njest.setTimeout(90_000);\ndescribe.each([1, 2, 3])("memory round %s", () => {\n' +
                cases +
                "\n});\n"
        );
        const result = spawnSync(
            process.execPath,
            [
                ...flags,
                "node_modules/jest/bin/jest.js",
                "--selectProjects",
                "build",
                "--runTestsByPath",
                temporary,
                "--runInBand",
                "--logHeapUsage",
                "--json",
                `--outputFile=${resultPath}`,
                "--setupFilesAfterEnv",
                path.join(root, "tests/jest.setup.ts"),
                path.join(import.meta.dirname, "override-pilot-metrics.cjs"),
            ],
            {
                cwd: root,
                env: {...process.env, ADNBN_OVERRIDE_BUILD_MODE: "in-process", ADNBN_PILOT_METRICS: metrics},
                encoding: "utf8",
                timeout: 180_000,
                maxBuffer: 8 * 1024 * 1024,
            }
        );
        fs.writeFileSync(path.join(output, "stress.log"), result.stdout + result.stderr);

        if (result.error || result.status !== 0) {
            throw new Error("Memory stress probe failed; see stress.log");
        }

        const data = JSON.parse(fs.readFileSync(resultPath, "utf8"));

        if (data.numPassedTests !== 90) {
            throw new Error("Expected 90 successful builds in one worker");
        }

        const leftovers = fs
            .readdirSync(path.join(root, ".cache/integration"))
            .filter(name => name.startsWith("fixture-"));

        if (leftovers.length) {
            throw new Error(`Memory stress probe left ${leftovers.length} fixture copies`);
        }

        report.stressFixtureCopiesRemaining = leftovers.length;
        report.stress = fs
            .readFileSync(metrics, "utf8")
            .trim()
            .split("\n")
            .map(JSON.parse)
            .map(sample => ({...sample, file: path.relative(root, sample.file)}));
        fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(report, null, 2) + "\n");
        console.log("Memory stress probe: 90 tests passed");
    } finally {
        fs.rmSync(temporary);
    }
}
