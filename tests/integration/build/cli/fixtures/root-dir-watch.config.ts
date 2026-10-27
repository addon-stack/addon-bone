import {defineConfig} from "adnbn";
import path from "node:path";
import type {Compiler} from "@rspack/core";

export default defineConfig({
    name: "Root Directory Watch Integration",
    version: "1.0.0",
    bundler: {
        plugins: [
            (compiler: Compiler) => {
                compiler.hooks.afterDone.tap("RootDirectoryWatch", stats => {
                    if (!compiler.watchMode || !process.send) {
                        return;
                    }

                    const compilation = {
                        event: "root-directory-compiled",
                        errors: stats.hasErrors(),
                        modified: Array.from(compiler.modifiedFiles ?? [], filename =>
                            path.relative(compiler.context, filename)
                        ),
                    };

                    // The CLI callback precedes watcher reconnection on nextTick; notify after both finish.
                    setImmediate(() => process.send?.(compilation));
                });
            },
        ],
    },
});
