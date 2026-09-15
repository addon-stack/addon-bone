import path from "node:path";
import {run} from "./integration/utils/process";
import {runQueue} from "./integration/utils/queue";

const root = path.resolve(import.meta.dirname, "..");
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run this check with npm run test:pre-push");

const phase = (tasks: {name: string; args: string[]; stdio?: "inherit"}[]) =>
    runQueue(tasks, tasks.length, async ({name, args, stdio}) => {
        const started = performance.now();
        console.info(`Starting ${name}`);
        await run(process.execPath, args, root, 300_000, {stdio, killTree: true});
        console.info(`Passed ${name} (${((performance.now() - started) / 1000).toFixed(1)} s)`);
    });

// Typecheck reads source declarations; the package build writes dist independently.
await phase([
    {name: "framework typecheck", args: ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "tsconfig.json"]},
    {name: "package build", args: [npm, "run", "build"]},
]);

// Jest owns disposable fixture copies. Fixture typechecks prepare the separate editor applications.
await phase([
    {
        name: "all non-browser tests",
        stdio: "inherit",
        args: ["scripts/test-run.mjs", "--selectProjects", "unit-node", "unit-dom", "build", "types"],
    },
    {
        name: "fixture builds and typechecks",
        args: ["node_modules/tsx/dist/cli.mjs", "tests/integration/typecheck.ts", "--prepare"],
    },
]);
