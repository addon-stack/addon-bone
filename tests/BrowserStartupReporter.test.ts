import {mkdtemp, readFile, rm} from "fs/promises";
import os from "os";
import path from "path";

import BrowserStartupReporter from "./BrowserStartupReporter.cjs";

test("the startup report retains successes and failures across files and excludes failures from duration percentiles", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "adnbn-startup-report-"));
    const outputFile = path.join(rootDir, "report.json");

    try {
        const reporter = new BrowserStartupReporter({rootDir}, {outputFile});

        for (const [index, durationMs] of [100, 300, 200, 400].entries()) {
            reporter.onTestResult(
                {path: path.join(rootDir, `${index}.test.ts`)},
                {
                    console: [
                        {
                            message:
                                "[browser-startup] " +
                                JSON.stringify({
                                    browser: "chrome",
                                    testName: "starts",
                                    status: "ready",
                                    durationMs,
                                    timeoutMs: 30_000,
                                }),
                        },
                    ],
                }
            );
        }

        reporter.onTestResult(
            {path: path.join(rootDir, "failed.test.ts")},
            {
                console: [
                    {
                        message:
                            "[browser-startup] " +
                            JSON.stringify({
                                browser: "firefox",
                                status: "failed",
                                durationMs: 30_000,
                                error: "startup deadline",
                            }),
                    },
                ],
            }
        );
        await reporter.onRunComplete();
        const report = JSON.parse(await readFile(outputFile, "utf8"));

        expect(report.samples).toHaveLength(5);
        expect(new Set(report.samples.map(sample => sample.testFile)).size).toBe(5);
        expect(report.summary.chrome).toEqual({attempts: 4, failures: 0, medianMs: 250, p95Ms: 400, maxMs: 400});
        expect(report.summary.firefox).toEqual({attempts: 1, failures: 1, medianMs: null, p95Ms: null, maxMs: null});
        expect(report.samples[4].error).toBe("startup deadline");
    } finally {
        await rm(rootDir, {recursive: true, force: true});
    }
});
