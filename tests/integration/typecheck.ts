import path from "path";
import {fileURLToPath} from "url";

import {findIntegrationFixtures, prepareIntegrationFixture} from "./utils/fixture";
import {run} from "./utils/process";
import {fixtureWorkers, runQueue} from "./utils/queue";

const directory = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.resolve(directory, "..", "..");

await runQueue(await findIntegrationFixtures(directory), fixtureWorkers(), async fixture => {
    if (process.argv.includes("--prepare")) {
        console.info(`Preparing ${path.relative(projectRoot, fixture)}`);
        await prepareIntegrationFixture(projectRoot, fixture, {}, 120_000);
    }
    console.info(`Typechecking ${path.relative(projectRoot, fixture)}`);
    await run(
        process.execPath,
        [path.join(projectRoot, "node_modules", "typescript", "bin", "tsc"), "--noEmit", "--project", "tsconfig.json"],
        fixture,
        120_000
    );
});
