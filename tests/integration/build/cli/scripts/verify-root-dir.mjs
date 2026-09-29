import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {cp, mkdir, readFile, readdir, symlink} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

const [projectRoot, directory, mode, sharedCwd] = process.argv.slice(2);
const {buildApp} = await import(pathToFileURL(path.join(projectRoot, "dist/cli/builders/app/index.js")).href);
const rootA = path.join(directory, "project a");
const rootB = path.join(directory, "project b");
const cwd = sharedCwd ?? path.join(directory, "unrelated");

await mkdir(cwd, {recursive: true});

for (const root of [rootA, rootB]) {
    await cp(path.join(import.meta.dirname, "../fixtures/root-dir"), root, {recursive: true});
    await mkdir(path.join(root, "node_modules"));
    await symlink(
        projectRoot,
        path.join(root, "node_modules/adnbn"),
        process.platform === "win32" ? "junction" : "dir"
    );
}

await cp(path.join(import.meta.dirname, "../fixtures/root-dir-b"), path.join(rootB, "src"), {recursive: true});
process.chdir(cwd);
const workingDirectory = process.cwd();
const environment = process.env;
const snapshot = {...environment};

const sequence = [
    [rootA, "A", "chrome"],
    [rootB, "B", "firefox"],
    [rootA, "A", "chrome"],
];

for (const [root, label, browser] of mode === "parallel" ? sequence.slice(1, 2) : sequence) {
    if (mode !== "cli") {
        const stats = await buildApp({
            rootDir: root,
            browser,
            mode: "production",
            plugins:
                mode === "parallel"
                    ? [
                          {
                              name: "hold-before-run",
                              bundler: {
                                  plugins: [
                                      {
                                          apply(compiler) {
                                              compiler.hooks.beforeRun.tapPromise(
                                                  "HoldBeforeRun",
                                                  () =>
                                                      new Promise(resolve => {
                                                          process.once("message", message => {
                                                              assert.equal(message, "build");
                                                              resolve();
                                                          });
                                                          process.send("ready");
                                                      })
                                              );
                                          },
                                      },
                                  ],
                              },
                          },
                      ]
                    : [],
        }).catch(error => {
            if (error.stats) {
                console.error(error.stats.toString({all: false, errors: true}));
            }

            throw error;
        });
        assert.equal(stats.hasErrors(), false);
    } else {
        const result = spawnSync(
            process.execPath,
            [path.join(projectRoot, "bin/adnbn.js"), "build", root, "-b", browser],
            {
                encoding: "utf8",
                timeout: 30_000,
            }
        );
        assert.equal(result.error, undefined);
        assert.equal(result.status, 0, result.stderr + result.stdout);
    }

    assert.equal(process.cwd(), workingDirectory);
    assert.equal(process.env, environment);
    assert.deepEqual({...process.env}, snapshot);
    const output = path.join(root, `dist/myapp-${browser}-mv3`);
    const html = await readFile(path.join(output, "newtab.html"), "utf8");
    const manifest = JSON.parse(await readFile(path.join(output, "manifest.json"), "utf8"));
    assert.ok(html.includes(`<title>Absolute root ${label}</title>`));
    assert.ok(
        JSON.stringify(manifest.content_security_policy).includes(`https://root-${label.toLowerCase()}.example.com`)
    );
    const scripts = (await readdir(output, {recursive: true})).filter(file => file.endsWith(".js"));
    const code = (await Promise.all(scripts.map(file => readFile(path.join(output, file), "utf8")))).join("\n");
    assert.ok(code.includes(`Root ${label} runtime`));
    assert.ok(code.includes("Offscreen root runtime"));

    if (browser === "firefox") {
        assert.ok(manifest.background.scripts.length > 0);
    }
}

console.log("Absolute root contract verified");

if (process.connected) {
    process.disconnect();
}
