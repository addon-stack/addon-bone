import {fixtureEntries, expectLocaleChunks, type Scenario} from "./chunks-utils";

jest.setTimeout(90_000);

test.each<Scenario>([
    {browser: "chrome", entries: ["popup"]},
    {browser: "chrome", entries: ["isolated.content"]},
    {browser: "chrome", entries: ["main.content"]},
    {browser: "chrome", entries: ["popup", "isolated.content"]},
    {browser: "chrome", entries: ["isolated.content", "main.content"]},
    {browser: "chrome", entries: ["main.content", "main-secondary.content"]},
    {browser: "chrome", entries: fixtureEntries},
    {browser: "firefox", entries: fixtureEntries},
])("$browser: $entries, bytes=$bytes, commonChunks=$enabled", expectLocaleChunks);
