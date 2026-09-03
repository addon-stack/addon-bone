import path from "path";
import {fileURLToPath} from "url";

import {findIntegrationFixtures, prepareIntegrationFixture} from "./utils/fixture";

const directory = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.resolve(directory, "..", "..");

for (const fixture of await findIntegrationFixtures(directory)) {
    console.info(`Preparing ${path.relative(projectRoot, fixture)}`);
    await prepareIntegrationFixture(projectRoot, fixture);
}
