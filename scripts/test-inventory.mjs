import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {existsSync} from "node:fs";
import path from "node:path";
import {promisify} from "node:util";
import {verifyMigrationInventory} from "./test-inventory-utils.mjs";

const execute = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const jest = path.join(root, "scripts/test-run.mjs");
const options = {cwd: root, maxBuffer: 10 * 1024 * 1024};
const {stdout: configuration} = await execute(process.execPath, [jest, "--showConfig"], options);
const projects = JSON.parse(configuration).configs.map(config => config.displayName.name);
const {stdout: tracked} = await execute(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    options
);
const expected = new Set(
    tracked.split("\0").filter(file => file.endsWith(".test.ts") && existsSync(path.join(root, file)))
);
const owners = new Map();

for (const project of projects) {
    const {stdout} = await execute(
        process.execPath,
        [jest, "--selectProjects", project, "--listTests", "--json", "--runInBand"],
        options
    );
    const files = JSON.parse(stdout);
    console.info(`${project}: ${files.length} files`);
    for (const filename of files) {
        const file = path.relative(root, filename).split(path.sep).join("/");
        assert(!owners.has(file), `${file} belongs to both ${owners.get(file)} and ${project}`);
        owners.set(file, project);
    }
}
assert.deepEqual(new Set(owners.keys()), expected, "Every test file must belong to exactly one Jest project");
console.info(`${expected.size} test files, each in exactly one project`);
verifyMigrationInventory(
    root,
    expected,
    tracked.split("\0").filter(file => file && existsSync(path.join(root, file)))
);
