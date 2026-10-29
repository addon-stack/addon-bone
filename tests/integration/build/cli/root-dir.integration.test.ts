import {jest} from "@jest/globals";

import {spawn, spawnSync, type ChildProcess} from "node:child_process";
import {mkdtempSync, rmSync} from "node:fs";
import {cp, mkdir, readFile, readdir, symlink, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {stop, waitFor} from "../../browser/utils/browser";

jest.setTimeout(90_000);

const projectRoot = path.resolve(import.meta.dirname, "../../../..");
const relativeForms = ["bare", "dot", "parent"];
const buildCases = ["api", "cli"].flatMap(mode =>
    ["absolute", ...relativeForms].flatMap(form => ["vanilla", "react"].map(renderer => ({mode, form, renderer})))
);

test.each(buildCases)(
    "$mode builds $renderer $form roots without changing the caller's working directory or environment",
    ({mode, form, renderer}) => {
        const directory = mkdtempSync(path.join(os.tmpdir(), "adnbn-root-dir-"));

        try {
            const result = spawnSync(
                process.execPath,
                [
                    path.join(import.meta.dirname, "scripts/verify-root-dir.mjs"),
                    projectRoot,
                    directory,
                    mode,
                    "",
                    form,
                    renderer,
                ],
                {encoding: "utf8", timeout: 60_000, maxBuffer: 4 * 1024 * 1024}
            );

            expect(result.error).toBeUndefined();
            expect({status: result.status, stderr: result.stderr}).toEqual({status: 0, stderr: ""});
            expect(result.stdout).toContain("Root directory contract verified");
        } finally {
            rmSync(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
        }
    }
);

interface RootCompilation {
    event: string;
    errors: boolean;
    modified: string[];
}

test.each(["absolute", ...relativeForms])(
    "CLI watch rebuilds with %s root paths after an imported source changes",
    async form => {
        const directory = mkdtempSync(path.join(os.tmpdir(), "adnbn-root-dir-"));
        const root = path.join(directory, "project a");
        const cwd = form === "parent" ? path.join(directory, "unrelated") : directory;
        const rootDir = form === "absolute" ? root : (form === "dot" ? `.${path.sep}` : "") + path.relative(cwd, root);
        const artifact = path.join(root, "dist/addon-chrome-mv3");
        const compilations: RootCompilation[] = [];
        let watcher: ChildProcess | undefined;
        let output = "";

        try {
            await cp(path.join(import.meta.dirname, "fixtures/root-dir"), root, {recursive: true});
            await cp(
                path.join(import.meta.dirname, "fixtures/root-dir-watch.config.ts"),
                path.join(root, "adnbn.config.ts")
            );
            // Keep resolution inside the disposable project instead of watching missing packages up to the temp root.
            await writeFile(path.join(root, "package.json"), '{"private":true,"type":"module"}\n');
            await mkdir(cwd, {recursive: true});
            await mkdir(path.join(root, "node_modules"));

            await symlink(
                projectRoot,
                path.join(root, "node_modules/adnbn"),
                process.platform === "win32" ? "junction" : "dir"
            );

            watcher = spawn(
                process.execPath,
                [path.join(projectRoot, "bin/adnbn.js"), "watch", rootDir, "-b", "chrome"],
                {
                    cwd,
                    stdio: ["ignore", "pipe", "pipe", "ipc"],
                }
            );

            watcher.stdout?.on("data", chunk => {
                output += chunk;
            });

            watcher.stderr?.on("data", chunk => {
                output += chunk;
            });

            watcher.on("message", message => {
                const compilation = message as RootCompilation;

                if (compilation?.event === "root-directory-compiled") {
                    compilations.push(compilation);
                }
            });

            const initial = await waitFor(
                async () => compilations[0],
                15_000,
                "initial relative-root watch compilation"
            );

            expect(initial.errors).toBe(false);
            expect(await readFile(path.join(artifact, "newtab.html"), "utf8")).toContain("Absolute root A");

            const readCode = async (): Promise<string> => {
                const scripts = (await readdir(artifact, {recursive: true})).filter(filename =>
                    filename.endsWith(".js")
                );

                return (
                    await Promise.all(scripts.map(filename => readFile(path.join(artifact, filename), "utf8")))
                ).join("\n");
            };

            expect(await readCode()).toContain("Root A runtime");
            const previous = compilations.length;
            const source = path.join("src", "values.ts");

            await writeFile(
                path.join(root, source),
                await readFile(path.join(import.meta.dirname, "fixtures/root-dir-watch-values.ts"))
            );

            const updated = await waitFor(
                async () => compilations.slice(previous).find(compilation => compilation.modified.includes(source)),
                15_000,
                "relative-root watch compilation observing the imported source edit"
            );

            expect(updated.errors).toBe(false);
            expect(watcher.exitCode).toBeNull();
            const code = await readCode();
            expect(code).toContain("Root B runtime");
            expect(code).not.toContain("Root A runtime");
        } catch (error) {
            throw new Error(`${String(error)}\n${output}`, {cause: error});
        } finally {
            try {
                if (watcher) {
                    await stop(watcher);
                }
            } finally {
                rmSync(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
            }
        }
    }
);
