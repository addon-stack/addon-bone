import {Compiler} from "@rspack/core";
import type {DevServer} from "@rspack/core";
import {RspackDevServer} from "@rspack/dev-server";

export const build = (compiler: Compiler) => {
    compiler.run((err, stats) => {
        if (err) {
            console.error("Rspack compilation error:", err);
            process.exit(1);
        }

        if (stats?.hasErrors()) {
            console.error(
                stats.toString({
                    colors: true,
                    errors: true,
                })
            );

            process.exit(1);
        }

        console.log(stats?.toString({colors: true}));

        compiler.close(closeErr => {
            if (closeErr) {
                console.error("Rspack close error:", closeErr);
                process.exit(1);
            }
        });
    });
};

export const watch = (compiler: Compiler) => {
    const watching = compiler.watch(
        {
            aggregateTimeout: 300,
            ignored: /node_modules/,
        },
        (err, stats) => {
            if (err) {
                console.error("Rspack watch error:", err);
                process.exit(1);
            }

            if (stats?.hasErrors()) {
                console.error(
                    stats.toString({
                        colors: true,
                        errors: true,
                    })
                );

                return;
            }

            console.log(stats?.toString({colors: true}));
        }
    );

    process.on("SIGINT", () => {
        watching.close(() => {
            console.log("Rspack watch mode stopped");
            process.exit(0);
        });
    });
};

export const serve = async (compiler: Compiler, server: DevServer = {}): Promise<void> => {
    // Phase-1 invariants are FORCED on top of user `server` config (spread first, override
    // after) — these are not user-tunable yet:
    // - writeToDisk: the browser loads the unpacked extension from disk, so assets (and
    //   later HMR update chunks) MUST be emitted, never served from memory only.
    // - hot/liveReload/client off: the single compiler also builds background and content
    //   scripts; a globally-injected dev-server client would break them (INV-3). A
    //   view-only HMR client is wired in a later phase.
    // - static off: nothing is served over HTTP — the dev server is only dev middleware
    //   (write-to-disk) plus, later, the HMR WebSocket. Leaving static on also makes the
    //   dev server watch a static dir and contributes to EMFILE.
    const options: DevServer = {
        ...server,
        hot: false,
        liveReload: false,
        client: false,
        static: false,
        devMiddleware: {
            ...server.devMiddleware,
            writeToDisk: true,
        },
    };

    const devServer = new RspackDevServer(options, compiler);

    await devServer.start();

    const shutdown = (): void => {
        devServer
            .stop()
            .catch(err => console.error("Rspack dev server stop error:", err))
            .finally(() => process.exit(0));
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
};
