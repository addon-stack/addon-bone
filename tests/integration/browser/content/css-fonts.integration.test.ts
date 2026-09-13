/** @jest-environment node */
import {runCssFontsProbe} from "./css-fonts-utils";

jest.setTimeout(90_000);

test("Chrome MV3 uses CSS-defined fonts in shadow roots and blank iframes without FontFace registration", async () => {
    await runCssFontsProbe("chrome", 3);
});
