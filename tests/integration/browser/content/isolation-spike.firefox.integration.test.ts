/** @jest-environment node */
import {runIsolationSpike} from "./isolation-spike-utils";

jest.setTimeout(90_000);

test.each([2, 3] as const)(
    "Firefox MV%s applies iframe CSS and fonts and recovers through context.mount after host moves",
    async version => {
        await runIsolationSpike("firefox", version);
    }
);
