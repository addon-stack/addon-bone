import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import os from "node:os";
import path from "node:path";
import {setImmediate} from "node:timers/promises";
import {fileURLToPath} from "node:url";
import {HtmlRspackPlugin, rspack} from "@rspack/core";

// Each variant runs in a fresh process. No framework code, Jest, or retained Stats.
const variants = [
    "baseline",
    "rule-test-regexp",
    "rule-test-function",
    "rule-include-function",
    "rule-use-function",
    "rule-query-function",
    "cache-group-regexp",
    "cache-group-function",
    "html-file",
    "html-string",
    "html-content-function",
    "html-parameters-function",
];
const [variant] = process.argv.slice(2);
const iterations = 12;

if (!variant) {
    const results = variants.map(name => {
        const child = spawnSync(process.execPath, ["--expose-gc", fileURLToPath(import.meta.url), name], {
            encoding: "utf8",
            timeout: 60_000,
        });
        assert.equal(child.error, undefined);
        assert.equal(child.status, 0, child.stderr);

        return JSON.parse(child.stdout);
    });
    const require = createRequire(import.meta.url);
    console.log(
        JSON.stringify(
            {
                node: process.version,
                platform: process.platform,
                arch: process.arch,
                rspack: require("@rspack/core/package.json").version,
                iterations,
                results,
            },
            null,
            2
        )
    );
} else {
    assert.ok(variants.includes(variant), `Unknown variant: ${variant}`);
    assert.equal(typeof global.gc, "function", "Run a single variant with node --expose-gc");
    const directory = await mkdtemp(path.join(os.tmpdir(), "rspack-retention-"));
    const references = [];

    try {
        const imports = [];

        for (let index = 0; index < 24; index++) {
            await writeFile(path.join(directory, `module-${index}.js`), `export default ${index};\n`);
            imports.push(`import value${index} from "./module-${index}.js"; console.log(value${index});`);
        }

        await writeFile(path.join(directory, "entry.js"), imports.join("\n"));
        await writeFile(path.join(directory, "loader.cjs"), "module.exports = source => source;\n");
        await writeFile(path.join(directory, "template.html"), "<html><body>Retention probe</body></html>");

        const configure = () => {
            const config = {
                mode: "production",
                context: directory,
                entry: path.join(directory, "entry.js"),
                devtool: false,
                output: {path: path.join(directory, "dist"), filename: "[name].js"},
                module: {rules: []},
                optimization: {},
                plugins: [],
            };
            const use = [path.join(directory, "loader.cjs")];

            if (variant === "rule-test-regexp") {
                config.module.rules.push({test: /\.js$/, use});
            } else if (variant === "rule-test-function") {
                config.module.rules.push({test: resource => resource.endsWith(".js"), use});
            } else if (variant === "rule-include-function") {
                config.module.rules.push({include: resource => resource.startsWith(directory), use});
            } else if (variant === "rule-use-function") {
                config.module.rules.push({test: /\.js$/, use: () => use});
            } else if (variant === "rule-query-function") {
                config.module.rules.push({resourceQuery: query => query === "", use});
            } else if (variant.startsWith("cache-group-")) {
                config.optimization.splitChunks = {
                    chunks: "all",
                    cacheGroups: {
                        probe: {
                            test:
                                variant === "cache-group-regexp"
                                    ? /module-\d+\.js$/
                                    : module => /module-\d+\.js$/.test(module.resource ?? ""),
                            name: "probe",
                            minSize: 0,
                        },
                    },
                };
            } else if (variant === "html-file") {
                config.plugins.push(new HtmlRspackPlugin({template: path.join(directory, "template.html")}));
            } else if (variant === "html-string") {
                config.plugins.push(
                    new HtmlRspackPlugin({templateContent: "<html><body>Retention probe</body></html>"})
                );
            } else if (variant === "html-content-function") {
                config.plugins.push(
                    new HtmlRspackPlugin({templateContent: () => "<html><body>Retention probe</body></html>"})
                );
            } else if (variant === "html-parameters-function") {
                config.plugins.push(
                    new HtmlRspackPlugin({
                        template: path.join(directory, "template.html"),
                        templateParameters: params => params,
                    })
                );
            }

            return config;
        };
        const build = async () => {
            const compiler = rspack(configure());
            references.push(new WeakRef(compiler));

            try {
                await new Promise((resolve, reject) => {
                    compiler.run((error, stats) => {
                        if (error || !stats || stats.hasErrors()) {
                            reject(error ?? new Error(stats?.toString({all: false, errors: true}) ?? "No stats"));
                        } else {
                            resolve();
                        }
                    });
                });
            } finally {
                await new Promise((resolve, reject) => {
                    compiler.close(error => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                });
            }
        };

        for (let index = 0; index < iterations; index++) {
            await build();
        }

        // Cross event-loop turns before collecting; do not dereference between collections.
        for (let index = 0; index < 4; index++) {
            await setImmediate();
            global.gc();
        }

        await readFile(path.join(directory, "dist/main.js"));
        const memory = process.memoryUsage();
        console.log(
            JSON.stringify({
                variant,
                alive: references.filter(reference => reference.deref()).length,
                heapUsed: memory.heapUsed,
                rss: memory.rss,
                external: memory.external,
                arrayBuffers: memory.arrayBuffers,
            })
        );
    } finally {
        await rm(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
}
