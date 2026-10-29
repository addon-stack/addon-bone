import path from "node:path";

import BackgroundEntry from "./BackgroundEntry";
import {BackgroundFinder} from "@cli/entrypoint";

import type {BackgroundEntrypointOptions} from "@typing/background";
import type {ReadonlyConfig} from "@typing/config";
import type {EntrypointFile, EntrypointOptionsFinder} from "@typing/entrypoint";

class TestBackgroundFinder extends BackgroundFinder {
    public constructor(private readonly entries: BackgroundEntrypointOptions[]) {
        super({rootDir: path.resolve(import.meta.dirname)} as ReadonlyConfig);
    }

    public plugin(): EntrypointOptionsFinder<BackgroundEntrypointOptions> {
        return this;
    }

    public async options(): Promise<Map<EntrypointFile, BackgroundEntrypointOptions>> {
        return new Map(
            this.entries.map((options, index) => {
                const file = path.resolve(import.meta.dirname, `${index}.background.ts`);

                return [{file, import: file}, options];
            })
        );
    }
}

interface PersistenceScenario {
    name: string;
    options: BackgroundEntrypointOptions[];
    expected: boolean | undefined;
}

describe("BackgroundEntry", () => {
    test.each<PersistenceScenario>([
        {name: "no entries", options: [], expected: undefined},
        {name: "explicit true", options: [{persistent: true}], expected: true},
        {name: "explicit false", options: [{persistent: false}], expected: false},
        {name: "omitted option", options: [{}], expected: undefined},
        {name: "false before omitted", options: [{persistent: false}, {}], expected: false},
        {name: "false after omitted", options: [{}, {persistent: false}], expected: false},
        {name: "true before false", options: [{persistent: true}, {persistent: false}], expected: true},
        {name: "true after false", options: [{persistent: false}, {persistent: true}], expected: true},
        {name: "all options omitted", options: [{}, {}], expected: undefined},
    ])("resolves persistence for $name", async ({options, expected}) => {
        const entry = new BackgroundEntry(new TestBackgroundFinder(options));

        await expect(entry.isPersistent()).resolves.toBe(expected);
    });
});
