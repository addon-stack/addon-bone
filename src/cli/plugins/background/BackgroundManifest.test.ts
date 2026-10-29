import path from "node:path";

import BackgroundEntry from "./BackgroundEntry";
import BackgroundManifest from "./BackgroundManifest";
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
    groups: BackgroundEntrypointOptions[][];
    expected: boolean | undefined;
}

describe("BackgroundManifest", () => {
    test.each<PersistenceScenario>([
        {name: "no groups", groups: [], expected: undefined},
        {name: "empty groups", groups: [[], [], []], expected: undefined},
        {name: "explicit true", groups: [[{persistent: true}]], expected: true},
        {name: "explicit false", groups: [[{persistent: false}]], expected: false},
        {name: "omitted option", groups: [[{}]], expected: undefined},
        {name: "false in Background", groups: [[{persistent: false}], [{}], [{}]], expected: false},
        {name: "false in Command", groups: [[{}], [{persistent: false}], [{}]], expected: false},
        {name: "false in Service", groups: [[{}], [{}], [{persistent: false}]], expected: false},
        {name: "false with empty groups", groups: [[], [{persistent: false}], []], expected: false},
        {
            name: "true in Background overrides false",
            groups: [[{persistent: true}], [{persistent: false}], [{persistent: false}]],
            expected: true,
        },
        {
            name: "true in Command overrides false",
            groups: [[{persistent: false}], [{persistent: true}], [{persistent: false}]],
            expected: true,
        },
        {
            name: "true in Service overrides false",
            groups: [[{persistent: false}], [{persistent: false}], [{persistent: true}]],
            expected: true,
        },
        {name: "all options omitted", groups: [[{}], [{}], [{}]], expected: undefined},
    ])("resolves persistence for $name", async ({groups, expected}) => {
        const manifest = new BackgroundManifest();

        for (const options of groups) {
            manifest.add(new BackgroundEntry(new TestBackgroundFinder(options)));
        }

        await expect(manifest.isPersistent()).resolves.toBe(expected);
    });
});
