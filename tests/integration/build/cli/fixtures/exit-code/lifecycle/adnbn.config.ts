import {mkdir, writeFile} from "fs/promises";
import path from "path";
import type {Compiler} from "@rspack/core";

const failure = process.env.ADNBN_TEST_BUILD_FAILURE;

export default {
    version: "1.0.0",
    plugins: [
        {
            name: "build-lifecycle-fixture",
            bundler: {
                plugins: [
                    {
                        apply(compiler: Compiler) {
                            compiler.hooks.beforeRun.tap("FailRun", () => {
                                if (failure === "run" || failure === "both") {
                                    throw new Error("Lifecycle fixture run failure");
                                }
                            });
                            compiler.hooks.thisCompilation.tap("FailCompilation", compilation => {
                                if (failure === "compilation") {
                                    compilation.errors.push(new Error("Lifecycle fixture compilation failure"));
                                }
                            });
                            compiler.hooks.shutdown.tapPromise("ObserveClose", async () => {
                                await mkdir(compiler.outputPath, {recursive: true});
                                await writeFile(path.join(compiler.outputPath, "compiler-closed.txt"), "closed");
                                console.log("Lifecycle fixture shutdown finished");

                                if (failure === "close" || failure === "both") {
                                    throw new Error("Lifecycle fixture close failure");
                                }
                            });
                        },
                    },
                ],
            },
        },
    ],
};
