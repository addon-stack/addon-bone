import {defineConfig} from "adnbn";
import type {Compiler} from "@rspack/core";

export default defineConfig({
    name: "Locale Catalogue Integration",
    description: "Build fixture for generated locale modules.",
    version: "1.0.0",
    bundler: {
        plugins: [
            (compiler: Compiler) => {
                compiler.hooks.afterDone.tap("LocaleWatchReady", () => {
                    if (!compiler.watchMode || !process.send) return;
                    // Rspack reconnects the filesystem watcher on nextTick after its CLI callback.
                    setImmediate(() => process.send?.("locale-watch-ready"));
                });
            },
        ],
    },
});
