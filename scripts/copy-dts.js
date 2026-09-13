import {globby} from "globby";
import {cp, mkdir} from "fs/promises";
import {dirname, join, relative} from "path";
import {fileURLToPath} from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const distRoot = join(root, "dist");

const files = await globby(
    [
        "src/**/*.d.ts",
        "!src/**/tests/**/*",
        "!src/**/__tests__/**/*",
        "!src/**/__mocks__/**/*",
        "!src/**/*.test.d.ts",
        "!src/**/*.spec.d.ts",
    ],
    {cwd: root, dot: true}
);

for (const file of files) {
    const rel = relative("src", file);
    const dest = join(distRoot, rel);
    await mkdir(dirname(dest), {recursive: true});
    await cp(join(root, file), dest, {force: true, recursive: false});
}

console.log(`DTS Copied ${files.length} .d.ts files to dist`);
