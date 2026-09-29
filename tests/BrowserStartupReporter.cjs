const {mkdir, writeFile} = require("node:fs/promises");
const path = require("node:path");

/** Collect structured session diagnostics from Jest workers, including failed test files. */
class BrowserStartupReporter {
    constructor(globalConfig, options = {}) {
        this.outputFile = path.resolve(
            globalConfig.rootDir,
            options.outputFile ?? process.env.ADNBN_BROWSER_STARTUP_REPORT ?? ".cache/integration/browser-startup.json"
        );
        this.samples = [];
    }

    onTestResult(test, result) {
        const prefix = "[browser-startup] ";

        for (const entry of result.console ?? []) {
            if (entry.message.startsWith(prefix)) {
                this.samples.push({testFile: test.path, ...JSON.parse(entry.message.slice(prefix.length))});
            }
        }
    }

    async onRunComplete() {
        const summary = {};

        for (const browser of ["chrome", "firefox"]) {
            const samples = this.samples.filter(sample => sample.browser === browser);
            const durations = samples.filter(sample => sample.status === "ready").map(sample => sample.durationMs);

            durations.sort((a, b) => a - b);

            const middle = Math.floor(durations.length / 2);
            summary[browser] = {
                attempts: samples.length,
                failures: samples.filter(sample => sample.status === "failed").length,
                medianMs: durations.length
                    ? durations.length % 2
                        ? durations[middle]
                        : (durations[middle - 1] + durations[middle]) / 2
                    : null,
                p95Ms: durations[Math.ceil(durations.length * 0.95) - 1] ?? null,
                maxMs: durations.at(-1) ?? null,
            };
        }

        await mkdir(path.dirname(this.outputFile), {recursive: true});
        await writeFile(
            this.outputFile,
            JSON.stringify(
                {
                    generatedAt: new Date().toISOString(),
                    node: process.version,
                    platform: process.platform,
                    arch: process.arch,
                    summary,
                    samples: this.samples,
                },
                null,
                2
            ) + "\n"
        );
    }
}

module.exports = BrowserStartupReporter;
