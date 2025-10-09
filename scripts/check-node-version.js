import semver from "semver";
import {readFileSync} from "fs";
import {fileURLToPath} from "url";
import {dirname, resolve} from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgPath = resolve(__dirname, "../package.json");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const required = pkg.engines?.node || ">=22.0.0";
const current = process.version;

if (!semver.satisfies(semver.clean(current), required)) {
    console.error(
        `\nUnsupported Node.js version ${current}. Addon Bone requires Node.js version ${required}.\n`
    );

    process.exit(1);
}
