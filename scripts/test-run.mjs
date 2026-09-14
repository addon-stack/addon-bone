import {spawn} from "node:child_process";
import {constants} from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
// Keep the workaround scoped to the environment where this project reproduces nodejs/node#62393.
const flags = process.platform === "darwin" && process.arch === "arm64" ? ["--no-sparkplug"] : [];
const child = spawn(
    process.execPath,
    [...flags, path.join(root, "node_modules/jest/bin/jest.js"), ...process.argv.slice(2)],
    {stdio: "inherit"}
);

const forward = signal => child.kill(signal);
const signals = ["SIGINT", "SIGTERM", "SIGHUP"];
for (const signal of signals) process.on(signal, forward);
child.once("error", error => {
    console.error(error);
    process.exitCode = 1;
});
child.once("close", (code, signal) => {
    for (const signal of signals) process.off(signal, forward);
    if (signal) console.error(`Jest terminated with ${signal}`);
    process.exitCode = code ?? (signal ? 128 + constants.signals[signal] : 1);
});
