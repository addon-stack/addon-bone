/** @jest-environment node */
import {runFramePagesIntegration} from "./frame-pages-utils";
jest.setTimeout(90_000);
test.each([2, 3] as const)(
    "Firefox MV%s embeds extension and external pages with production frame nodes",
    async version => {
        await runFramePagesIntegration("firefox", version);
    }
);
