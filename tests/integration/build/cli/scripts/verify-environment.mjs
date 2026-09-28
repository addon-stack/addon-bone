import assert from "node:assert/strict";
import {cp, mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

const [modulePath, directory, scenario] = process.argv.slice(2);
const {buildApp} = await import(pathToFileURL(modulePath).href);
const configFile =
    scenario === "sequence-mts"
        ? "adnbn.config.mts"
        : scenario === "sequence-cts"
          ? "adnbn.config.cts"
          : "adnbn.config.ts";
const rootA = path.join(directory, "a");
const rootB = path.join(directory, "b");

for (const root of [rootA, rootB]) {
    await mkdir(root);
    await cp(path.join(import.meta.dirname, "../fixtures/environment/adnbn.config.ts"), path.join(root, configFile));
}

await writeFile(path.join(rootA, ".env"), "ADNBN_BUILD_VALUE=A\nADNBN_BUILD_ONLY_A=only-a");
await writeFile(path.join(rootB, ".env"), "ADNBN_BUILD_VALUE=B");
process.env.ADNBN_BUILD_CHANGED = "caller";
process.env.ADNBN_BUILD_DELETED = "caller";
const environment = process.env;
const snapshot = {...environment};
const options = rootDir => ({rootDir, configFile, app: "environment"});
const restored = () => {
    assert.equal(process.env, environment);
    assert.deepEqual({...process.env}, snapshot);
};
const verifyBuild = async (root, browser, manifestVersion, expected) => {
    const stats = await buildApp({...options(root), browser, manifestVersion});
    assert.equal(stats.hasErrors(), false);
    restored();
    const manifest = JSON.parse(
        await readFile(path.join(root, `dist/environment-${browser}-mv${manifestVersion}/manifest.json`), "utf8")
    );
    assert.equal(manifest.name, expected);
    assert.equal(manifest.manifest_version, manifestVersion);
};

if (scenario.startsWith("sequence")) {
    await verifyBuild(rootA, "chrome", 3, "A");
    await verifyBuild(rootB, "firefox", 2, "B");
    await writeFile(path.join(rootA, ".env"), "ADNBN_BUILD_VALUE=A-again\nADNBN_BUILD_ONLY_A=only-a");
    await verifyBuild(rootA, "chrome", 3, "A-again");

    for (const [root, expected, browser, manifestVersion] of [
        [rootA, ["A", "A-again"], "chrome", "3"],
        [rootB, ["B"], "firefox", "2"],
    ]) {
        const records = (await readFile(path.join(root, "observations.jsonl"), "utf8"))
            .trim()
            .split("\n")
            .map(JSON.parse);
        assert.deepEqual(
            records.map(record => record.stage),
            expected.flatMap(() => ["config", "startup", "bundler", "run", "close"])
        );

        for (const [index, value] of expected.entries()) {
            for (const record of records.slice(index * 5, (index + 1) * 5)) {
                assert.equal(record.value, value);
                assert.equal(record.browser, browser);
                assert.equal(record.manifestVersion, manifestVersion);
                assert.equal(record.onlyA, root === rootA ? "only-a" : undefined);
            }
        }
    }
} else if (scenario.startsWith("unsupported-")) {
    const filename = `adnbn.config.${scenario.slice("unsupported-".length)}`;
    await cp(path.join(import.meta.dirname, "../fixtures/environment/adnbn.config.ts"), path.join(rootA, filename));
    await assert.rejects(buildApp({...options(rootA), configFile: filename}), /requires a TypeScript config/);
    restored();
    await assert.rejects(readFile(path.join(rootA, "observations.jsonl")), {code: "ENOENT"});
    await verifyBuild(rootB, "firefox", 2, "B");
} else if (scenario.startsWith("overlap")) {
    const entered = Promise.withResolvers();
    const release = Promise.withResolvers();
    const running = buildApp({
        ...options(rootA),
        plugins: [
            {
                name: "hold-startup",
                async startup() {
                    if (scenario === "overlap") {
                        entered.resolve();
                        await release.promise;
                    }
                },
                bundler: {
                    plugins: [
                        {
                            apply(compiler) {
                                if (scenario === "overlap-close") {
                                    compiler.hooks.shutdown.tapPromise("HoldShutdown", async () => {
                                        entered.resolve();
                                        await release.promise;
                                    });
                                }
                            },
                        },
                    ],
                },
            },
        ],
    });

    try {
        await entered.promise;
        const active = {...process.env};
        await assert.rejects(buildApp(options(rootB)), /already running/);
        assert.deepEqual({...process.env}, active);
    } finally {
        release.resolve();
        await running;
    }

    restored();
    await verifyBuild(rootB, "firefox", 2, "B");
} else {
    process.env.ADNBN_BUILD_FAILURE = scenario;
    const failingSnapshot = {...process.env};
    let compiler;

    try {
        await assert.rejects(
            buildApp({
                ...options(rootA),
                plugins: [
                    {
                        name: "capture-compiler",
                        bundler: {
                            plugins: [
                                {
                                    apply(current) {
                                        compiler = current;
                                    },
                                },
                            ],
                        },
                    },
                ],
            }),
            error => {
                const diagnostic = [
                    error.message,
                    error.cause?.message,
                    error.stats?.toString({all: false, errors: true}),
                ].join("\n");
                assert.match(diagnostic, new RegExp(`Environment fixture ${scenario} failure`));

                return true;
            }
        );
        assert.deepEqual({...process.env}, failingSnapshot);
    } finally {
        // A failing shutdown hook interrupts native cleanup; release the real compiler after checking restoration.
        if (scenario === "close" && compiler) {
            await new Promise((resolve, reject) =>
                compiler.close(error => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                })
            );
        }
    }

    delete process.env.ADNBN_BUILD_FAILURE;
    restored();
    await verifyBuild(rootB, "firefox", 2, "B");
}

console.log("Environment contract verified");
