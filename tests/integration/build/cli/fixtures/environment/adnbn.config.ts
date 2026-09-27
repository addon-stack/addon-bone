import {appendFileSync} from "node:fs";
import path from "node:path";

const failure = process.env.ADNBN_BUILD_FAILURE;
const record = stage => {
    appendFileSync(
        path.join(import.meta.dirname, "observations.jsonl"),
        JSON.stringify({
            stage,
            value: process.env.ADNBN_BUILD_VALUE,
            onlyA: process.env.ADNBN_BUILD_ONLY_A,
            browser: process.env.BROWSER,
            mode: process.env.MODE,
            manifestVersion: process.env.MANIFEST_VERSION,
        }) + "\n"
    );
};

record("config");
process.env.ADNBN_BUILD_ADDED = "from-config";
process.env.ADNBN_BUILD_CHANGED = "from-config";
delete process.env.ADNBN_BUILD_DELETED;

if (failure === "config") {
    throw new Error("Environment fixture config failure");
}

export default {
    name: process.env.ADNBN_BUILD_VALUE,
    version: "1.0.0",
    plugins: [
        {
            name: "environment-fixture",
            startup() {
                record("startup");

                if (failure === "startup") {
                    throw new Error("Environment fixture startup failure");
                }
            },
            bundler() {
                record("bundler");

                if (failure === "bundler") {
                    throw new Error("Environment fixture bundler failure");
                }

                return {
                    plugins: [
                        {
                            apply(compiler) {
                                compiler.hooks.beforeRun.tap("EnvironmentFixture", () => {
                                    record("run");

                                    if (failure === "run") {
                                        throw new Error("Environment fixture run failure");
                                    }
                                });

                                compiler.hooks.thisCompilation.tap("EnvironmentFixture", compilation => {
                                    if (failure === "compilation") {
                                        compilation.errors.push(new Error("Environment fixture compilation failure"));
                                    }
                                });

                                let closes = 0;

                                compiler.hooks.shutdown.tap("EnvironmentFixture", () => {
                                    record("close");

                                    if (failure === "close" && ++closes === 1) {
                                        throw new Error("Environment fixture close failure");
                                    }
                                });
                            },
                        },
                    ],
                };
            },
        },
    ],
};
