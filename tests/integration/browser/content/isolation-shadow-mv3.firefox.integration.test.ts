import {runIsolatedStylesIntegration} from "./isolated-styles-utils";

jest.setTimeout(90_000);

test("Firefox MV3 renders production Shadow DOM styles and local fonts under strict page CSP", async () => {
    await runIsolatedStylesIntegration("firefox", 3);
});
