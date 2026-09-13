/** @jest-environment node */
import {runCssFontsProbe} from "./css-fonts-utils";

jest.setTimeout(90_000);

test.each([2, 3] as const)("Firefox MV%s uses CSS-defined fonts without FontFace registration", async version => {
    await runCssFontsProbe("firefox", version);
});
