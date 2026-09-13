/** @jest-environment node */
import {runIsolationSpike} from "./isolation-spike-utils";

jest.setTimeout(90_000);

test("Chrome MV3 applies iframe CSS and fonts and recovers through context.mount after host moves", async () => {
    await runIsolationSpike("chrome", 3);
});
