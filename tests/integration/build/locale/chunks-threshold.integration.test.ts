import {fixtureEntries, expectLocaleChunks, type Scenario} from "./chunks-utils";

jest.setTimeout(90_000);

test.each<Scenario>([
    {browser: "chrome", entries: ["main.content", "main-secondary.content"], bytes: 100_000},
    {browser: "chrome", entries: fixtureEntries, bytes: 100_000},
    {browser: "chrome", entries: ["popup"], bytes: 99_999},
    {browser: "chrome", entries: ["popup"], bytes: 100_000},
    {browser: "chrome", entries: ["isolated.content"], bytes: 100_000},
    {browser: "chrome", entries: ["main.content"], bytes: 100_000},
    {browser: "chrome", entries: ["isolated.content", "main.content"], bytes: 100_000},
    {browser: "chrome", entries: [], bytes: 100_000},
])("$browser: $entries, bytes=$bytes, commonChunks=$enabled", expectLocaleChunks);
