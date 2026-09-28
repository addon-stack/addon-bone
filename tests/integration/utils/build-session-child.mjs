import path from "node:path";
import {pathToFileURL} from "node:url";

// Install before loading the framework: the parent may disappear during startup or a build.
process.on("disconnect", () => process.exit(0));

const [projectRoot] = process.argv.slice(2);
const app = import(pathToFileURL(path.join(projectRoot, "dist/cli/builders/app/index.js")).href);
// The request handler reports load failures through the same error protocol as build failures.
app.catch(() => {});
let active = false;
let builds = 0;

const serializeError = (error, depth = 0) => ({
    name: error?.name ?? "Error",
    message: error?.message ?? String(error),
    ...(error?.cause !== undefined && depth < 5 ? {cause: serializeError(error.cause, depth + 1)} : {}),
    ...(error?.stats
        ? {stats: error.stats.toString({all: false, errors: true, errorDetails: true, colors: false})}
        : {}),
});

process.on("message", async request => {
    if (request.close) {
        process.exit(0);
    }

    if (active) {
        // A parent protocol violation cannot leave overlapping builds running.
        process.exit(1);
    }

    active = true;
    const environment = process.env;
    let failure;

    try {
        process.env = {...request.environment};
        const {buildApp} = await app;
        await buildApp({
            rootDir: request.rootDir,
            browser: request.browser,
            manifestVersion: request.manifestVersion,
            mode: "production",
        });
    } catch (error) {
        failure = serializeError(error);
    } finally {
        process.env = environment;
        active = false;
    }

    builds++;

    if (global.gc) {
        global.gc();
    }

    const {rss, heapUsed} = process.memoryUsage();

    if (process.connected) {
        process.send({
            id: request.id,
            ...(failure ? {error: failure} : {}),
            sample: {
                pid: process.pid,
                build: builds,
                rootDir: request.rootDir,
                cwd: process.cwd(),
                rss,
                heapUsed,
                maxRssKiB: process.resourceUsage().maxRSS,
            },
        });
    }
});

process.send?.({ready: true});
