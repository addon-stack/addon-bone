import path from "path";
import {fileURLToPath} from "url";

import {findIntegrationFixtures, prepareIntegrationFixture} from "./utils/fixture";
import {fixtureWorkers, runQueue} from "./utils/queue";

const directory = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.resolve(directory, "..", "..");

await runQueue(await findIntegrationFixtures(directory), fixtureWorkers(), async fixture => {
    console.info(`Preparing ${path.relative(projectRoot, fixture)}`);
    await prepareIntegrationFixture(projectRoot, fixture, {}, 120_000);
});
