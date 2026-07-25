import {Compiler, rspack} from "@rspack/core";
import type {DevServer, Configuration as RspackConfig} from "@rspack/core";
import {RspackDevServer} from "@rspack/dev-server";
import {watch as watchPaths} from "chokidar";
import {rm} from "node:fs/promises";

import {getOutputPath, getSourcePath} from "@cli/resolvers/path";
import {hash} from "@cli/utils/hash";

import {SystemDir} from "@typing/app";
import type {ReadonlyConfig} from "@typing/config";
import type {TopologySnapshot} from "@typing/topology";

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

/**
 * Run the dev server over a compiler, restarting the whole pipeline when the build's SHAPE
 * changes (the entry set, HTML filenames, and other creation-time options that can't be updated
 * on an already-created compiler).
 *
 * A directory watcher over the app source tree observes `add`/`unlink`/`addDir`/`unlinkDir` AND
 * `change` — but `change` is only a PROBE: on any event we re-run discovery and restart (stop →
 * clean output → fresh pipeline; one recompute, INV-1) ONLY when the discovery fingerprint
 * actually changed. Pure content edits leave the fingerprint untouched and ride the running
 * compiler's own incremental watch; manifest content (permissions, csp, content-script matches…)
 * is re-emitted live by ManifestPlugin/WatchPlugin without a restart.
 */
export const serve = async (
    initial: {compiler: Compiler; snapshot: TopologySnapshot},
    config: ReadonlyConfig,
    discover: () => Promise<{rspackConfig: RspackConfig; snapshot: TopologySnapshot}>
): Promise<void> => {
    const {server = {}} = config;

    // Forced dev invariants on top of user `server` config (spread first, override after):
    // - writeToDisk: the browser loads the unpacked extension from disk, so assets (and later
    //   HMR update chunks) MUST be emitted, never served from memory only.
    // - hot/liveReload/client off: the single compiler also builds background and content
    //   scripts; a globally-injected dev-server client would break them (INV-3). A view-only
    //   HMR client is wired in a later phase.
    // - static off: nothing is served over HTTP — the dev server is only dev middleware
    //   (write-to-disk) plus, later, the HMR WebSocket; static serving also adds an FS watcher.
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

    let devServer = new RspackDevServer(options, initial.compiler);

    await devServer.start();

    const outputPath = getOutputPath(config);

    const closeCompiler = (instance: Compiler): Promise<void> =>
        new Promise(resolve => instance.close(() => resolve()));

    // The dev build's SHAPE (entries, HTML pages + their title/template, tag options, virtual
    // modules) as a framework-owned snapshot. Everything baked into the compiler at creation
    // lives here; when it changes the running compiler is the wrong shape and must be recreated.
    // Content edits leave it untouched and ride the compiler's own watch; manifest content
    // (permissions, csp, matches…) is re-emitted live by ManifestPlugin/WatchPlugin — no restart.
    let current = hash(initial.snapshot);

    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    let again = false;

    const evaluate = async (): Promise<void> => {
        // Single-flight: never run two pipelines at once; coalesce events that land mid-rebuild.
        if (busy) {
            again = true;
            return;
        }

        busy = true;

        let fresh: Compiler | undefined;
        let adopted = false;

        try {
            // The running compiler doesn't re-discover on its own, so re-run discovery (cheap —
            // NO compiler is created) and compare the shape; build a fresh compiler only when the
            // snapshot actually changed.
            const {rspackConfig, snapshot} = await discover();
            const next = hash(snapshot);

            if (next === current) {
                return;
            }

            fresh = rspack(rspackConfig);

            const nextServer = new RspackDevServer(options, fresh);

            await devServer.stop();

            // Topology changed → re-emit from scratch so removed/renamed entrypoints leave no
            // stale output (dev keeps output.clean off across incremental rebuilds).
            await rm(outputPath, {recursive: true, force: true});

            await nextServer.start();

            devServer = nextServer;
            adopted = true;
            current = next;
        } catch (e) {
            console.error("Rspack dev server restart error:", e);
        } finally {
            // Release the freshly-built compiler if a failure stopped it from being adopted.
            if (fresh && !adopted) {
                await closeCompiler(fresh);
            }

            busy = false;

            if (again) {
                again = false;
                schedule();
            }
        }
    };

    const schedule = (): void => {
        clearTimeout(timer);
        timer = setTimeout(() => void evaluate(), 250);
    };

    // Ignore non-source trees that may sit under the watched root: dependencies, the framework's
    // own generated dir (SystemDir), and the build output (config.outDir) — no raw literals.
    const ignoredDirs = new Set(["node_modules", SystemDir, config.outDir]);

    const watcher = watchPaths(getSourcePath(config), {
        ignoreInitial: true,
        ignored: (target: string) => target.split(/[\\/]/).some(segment => ignoredDirs.has(segment)),
    });

    // A file added/removed/renamed, or an entrypoint's options edited (e.g. `as` → HTML name),
    // can change the entry set or HTML filenames → re-evaluate and restart only if the discovery
    // fingerprint actually changed; pure content edits fall through to the compiler's own watch.
    watcher
        .on("add", schedule)
        .on("unlink", schedule)
        .on("addDir", schedule)
        .on("unlinkDir", schedule)
        .on("change", schedule);

    const shutdown = (): void => {
        clearTimeout(timer);

        Promise.resolve(watcher.close())
            .catch(err => console.error("Watcher close error:", err))
            .finally(() =>
                devServer
                    .stop()
                    .catch(err => console.error("Rspack dev server stop error:", err))
                    .finally(() => process.exit(0))
            );
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
};
