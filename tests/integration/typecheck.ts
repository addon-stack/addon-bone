import path from "path";
import {fileURLToPath} from "url";

import {findIntegrationFixtures} from "./utils/fixture";
import {run} from "./utils/process";

const directory = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.resolve(directory, "..", "..");

for (const fixture of await findIntegrationFixtures(directory)) {
    console.info(`Typechecking ${path.relative(projectRoot, fixture)}`);
    await run(
        process.execPath,
        [path.join(projectRoot, "node_modules", "typescript", "bin", "tsc"), "--noEmit", "--project", "tsconfig.json"],
        fixture
    );
}
