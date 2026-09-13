/** @jest-environment node */
import {runIsolatedStylesIntegration} from "./isolated-styles-utils";
jest.setTimeout(90_000);
test.each([2, 3] as const)(
    "Firefox MV%s renders production iframe UI, CSS and fonts under strict CSP",
    async version => {
        await runIsolatedStylesIntegration("firefox", version, "isolation-iframe");
    }
);
