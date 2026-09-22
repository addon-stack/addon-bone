import path from "path";

import CommandFinder from "./CommandFinder";

import {toPosix} from "@cli/utils/path";

import type {ReadonlyConfig} from "@typing/config";

const fixtures = path.resolve(__dirname, "tests", "fixtures", "command");

const makeFinder = (scenario: string, overrides: Partial<ReadonlyConfig> = {}): CommandFinder => {
    const config = {
        app: "app",
        appSrcDir: ".",
        appsDir: "apps",
        debug: false,
        mergeCommands: false,
        plugins: [],
        rootDir: fixtures,
        sharedDir: ".",
        srcDir: scenario,
        ...overrides,
    } as Partial<ReadonlyConfig> as ReadonlyConfig;

    const finder = new CommandFinder(config);

    config.plugins.push({name: "adnbn:background", command: () => finder.files()});

    return finder;
};

const source = (scenario: string, file: string): string => {
    return path.join(fixtures, scenario, file);
};

describe("CommandFinder", () => {
    test("keeps explicit, file-derived and action command names as they are", async () => {
        const root = path.join(fixtures, "unique");
        const commands = await makeFinder("unique").commands();

        expect(
            Object.fromEntries(Array.from(commands, ([{file}, {name}]) => [toPosix(path.relative(root, file)), name]))
        ).toEqual({
            "action.command.ts": "_execute_action",
            "close.command.ts": "close",
            "open.command.ts": "open",
        });
    });

    test("rejects two commands with the same explicit name", async () => {
        await expect(makeFinder("explicit").commands()).rejects.toThrow(
            `Invalid command options in "${source("explicit", "open.command.ts")}": Command name "open" is already used by "${source("explicit", "launch.command.ts")}". Command names must be unique, set a distinct "name"`
        );
    });

    test("rejects app and shared commands that derive the same name when merged", async () => {
        await expect(makeFinder("merge", {sharedDir: "shared", mergeCommands: true}).commands()).rejects.toThrow(
            `Invalid command options in "${source("merge", "apps/app/open.command.ts")}": Command name "open" is already used by "${source("merge", "shared/open.command.ts")}". Command names must be unique, set a distinct "name"`
        );
    });

    test("rejects a second action command", async () => {
        await expect(makeFinder("action").commands()).rejects.toThrow(
            `Invalid command options in "${source("action", "toggle.command.ts")}": An action command is already defined in "${source("action", "open.command.ts")}". Only one action command is allowed`
        );
    });
});
