import {fixtureEntries, expectLocaleChunks, type Scenario} from "./chunks-utils";

jest.setTimeout(90_000);

test.each<Scenario>([{browser: "chrome", entries: fixtureEntries, enabled: false}])(
    "$browser: $entries, bytes=$bytes, commonChunks=$enabled",
    expectLocaleChunks
);
