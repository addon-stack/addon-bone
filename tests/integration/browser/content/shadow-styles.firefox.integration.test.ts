/** @jest-environment node */

import {runShadowStylesIntegration} from "./shadow-styles-utils";

jest.setTimeout(90_000);

test.each([2, 3] as const)(
    "Firefox MV%s renders production Shadow DOM styles and local fonts under strict page CSP",
    async version => {
        await runShadowStylesIntegration("firefox", version);
    }
);
