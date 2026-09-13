/** @jest-environment node */
import {runFramePagesIntegration} from "./frame-pages-utils";
jest.setTimeout(90_000);
test("Chrome MV3 embeds an extension page and MAIN external source with production frame nodes", async () => {
    await runFramePagesIntegration("chrome", 3);
});
