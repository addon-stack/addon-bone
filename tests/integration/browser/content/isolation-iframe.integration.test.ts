/** @jest-environment node */
import {runIsolatedStylesIntegration} from "./isolated-styles-utils";
jest.setTimeout(90_000);
test("Chrome MV3 renders production iframe UI, CSS and fonts under strict CSP", async () => {
    await runIsolatedStylesIntegration("chrome", 3, "isolation-iframe");
});
