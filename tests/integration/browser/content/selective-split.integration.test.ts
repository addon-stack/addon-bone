import {runSelectiveSplitProbe} from "./selective-split-utils";

jest.setTimeout(90_000);

test("Chrome MV3 loads the shared lazy CSS pair in chunk order and keeps document styles outside ShadowRoot", async () => {
    await runSelectiveSplitProbe("chrome", 3);
});
