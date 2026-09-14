import {execFileSync} from "node:child_process";
import path from "node:path";
import * as prettier from "prettier";

const root = path.resolve(import.meta.dirname, "..");
const git = args => execFileSync("git", args, {cwd: root, encoding: "utf8"});
const changed = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]).split("\0").filter(Boolean);
const unformatted = [];

for (const file of changed) {
    const filepath = path.join(root, file);
    const info = await prettier.getFileInfo(filepath, {ignorePath: path.join(root, ".prettierignore")});
    if (info.ignored || !info.inferredParser) continue;
    // Check the staged contents; never rewrite unstaged work or silently stage it.
    const contents = git(["show", `:${file}`]);
    if (!(await prettier.check(contents, {...(await prettier.resolveConfig(filepath)), filepath})))
        unformatted.push(file);
}
if (unformatted.length) {
    console.error(`Format and stage these files before committing:\n${unformatted.join("\n")}`);
    process.exit(1);
}
