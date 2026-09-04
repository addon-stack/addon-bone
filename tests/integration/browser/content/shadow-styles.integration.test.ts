/** @jest-environment node */

import {runShadowStylesIntegration} from "./shadow-styles-utils";

jest.setTimeout(90_000);

test("Chrome MV3 renders production Shadow DOM styles and local fonts under strict page CSP", async () => {
    await runShadowStylesIntegration("chrome", 3);
});
