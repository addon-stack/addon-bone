import path from "node:path";

import {findIntegrationFixtures} from "./fixture";

const integration = path.resolve(__dirname, "..");

test("does not prepare internal CLI configs as standalone consumer applications", async () => {
    expect(await findIntegrationFixtures(path.join(integration, "build/cli"))).toEqual([]);
});

test("discovers the three complete override applications", async () => {
    const override = path.join(integration, "build/override");

    expect(await findIntegrationFixtures(override)).toEqual([
        path.join(override, "bookmarks"),
        path.join(override, "history"),
        path.join(override, "newtab"),
    ]);
});
