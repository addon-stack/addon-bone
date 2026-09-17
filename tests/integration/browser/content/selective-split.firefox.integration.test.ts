import {runSelectiveSplitProbe} from "./selective-split-utils";

jest.setTimeout(90_000);

test.each([2, 3] as const)(
    "Firefox MV%s keeps the shared lazy CSS pair in chunk order for normal and shadow consumers",
    async version => {
        await runSelectiveSplitProbe("firefox", version);
    }
);
