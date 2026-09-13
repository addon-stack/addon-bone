/** @jest-environment node */

import {runIsolatedStylesIntegration} from "./isolated-styles-utils";

jest.setTimeout(90_000);

test("Chrome MV3 renders production Shadow DOM styles and local fonts under strict page CSP", async () => {
    await runIsolatedStylesIntegration("chrome", 3);
});
